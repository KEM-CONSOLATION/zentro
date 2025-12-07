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

    // Get user's organization_id
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user_id)
      .single()
    
    const organizationId = profile?.organization_id || null

    // Reject future dates
    const today = new Date().toISOString().split('T')[0]
    if (date > today) {
      return NextResponse.json({ error: 'Cannot record opening stock for future dates' }, { status: 400 })
    }

    // Validate items array
    const openingStockRecords = items.map((item: { 
      item_id: string
      quantity: number
      cost_price?: number | null
      selling_price?: number | null
    }) => ({
      item_id: item.item_id,
      quantity: item.quantity,
      cost_price: item.cost_price ?? null,
      selling_price: item.selling_price ?? null,
      date,
      recorded_by: user_id,
      organization_id: organizationId,
      notes: 'Manually entered opening stock',
    }))

    const { error: upsertError } = await supabaseAdmin
      .from('opening_stock')
      .upsert(openingStockRecords, {
        onConflict: 'item_id,date,organization_id',
      })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    for (const record of openingStockRecords) {
      if (record.cost_price !== null && record.cost_price !== undefined) {
        const { error: itemUpdateError } = await supabaseAdmin
          .from('items')
          .update({ cost_price: record.cost_price })
          .eq('id', record.item_id)
        
        if (itemUpdateError) {
          console.error(`Failed to update cost_price for item ${record.item_id}:`, itemUpdateError)
        }
      }
      
      if (record.selling_price !== null && record.selling_price !== undefined) {
        const { error: itemUpdateError } = await supabaseAdmin
          .from('items')
          .update({ selling_price: record.selling_price })
          .eq('id', record.item_id)
        
        if (itemUpdateError) {
          console.error(`Failed to update selling_price for item ${record.item_id}:`, itemUpdateError)
        }
      }
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

