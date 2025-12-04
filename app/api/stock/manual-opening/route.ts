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

    // Validate items array
    const openingStockRecords = items.map((item: { item_id: string; quantity: number }) => ({
      item_id: item.item_id,
      quantity: item.quantity,
      date,
      recorded_by: user_id,
      notes: 'Manually entered opening stock',
    }))

    // Upsert opening stock records (update if exists, insert if not)
    const { error: upsertError } = await supabaseAdmin
      .from('opening_stock')
      .upsert(openingStockRecords, {
        onConflict: 'item_id,date',
      })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Opening stock saved for ${date}`,
      records_saved: openingStockRecords.length,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to save opening stock'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

