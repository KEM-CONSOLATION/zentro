import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const body = await request.json()
    const { date, items, user_id } = body

    if (!date || !items || !Array.isArray(items) || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get user's organization/branch
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id, branch_id, role')
      .eq('id', user_id)
      .single()

    const organizationId = profile?.organization_id || null
    const branchId = profile?.role === 'admin' && !profile?.branch_id ? null : profile?.branch_id || null

    // Validate items array
    const closingStockRecords = items.map((item: { item_id: string; quantity: number }) => ({
      item_id: item.item_id,
      quantity: item.quantity,
      date,
      recorded_by: user_id,
      organization_id: organizationId,
      branch_id: branchId,
      notes: 'Manually entered closing stock',
    }))

    // Upsert closing stock records (update if exists, insert if not)
    const { error: upsertError } = await supabaseAdmin
      .from('closing_stock')
      .upsert(closingStockRecords, {
        onConflict: 'item_id,date,organization_id,branch_id',
      })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Closing stock saved for ${date}`,
      records_saved: closingStockRecords.length,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to save closing stock'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
