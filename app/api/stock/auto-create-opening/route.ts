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
    const { date, user_id } = body

    if (!date || !user_id) {
      return NextResponse.json({ error: 'Missing date or user_id' }, { status: 400 })
    }

    // Reject future dates
    const today = new Date().toISOString().split('T')[0]
    if (date > today) {
      return NextResponse.json({ error: 'Cannot create opening stock for future dates' }, { status: 400 })
    }

    // Calculate previous date
    const dateObj = new Date(date + 'T00:00:00')
    const prevDate = new Date(dateObj)
    prevDate.setDate(prevDate.getDate() - 1)
    const prevDateStr = prevDate.toISOString().split('T')[0]

    // Get all items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('items')
      .select('*')
      .order('name')

    if (itemsError || !items) {
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    // Get previous day's closing stock
    const { data: prevClosingStock } = await supabaseAdmin
      .from('closing_stock')
      .select('item_id, quantity')
      .eq('date', prevDateStr)

    // Get previous day's opening stock to use prices if available
    const { data: prevOpeningStock } = await supabaseAdmin
      .from('opening_stock')
      .select('item_id, cost_price, selling_price')
      .eq('date', prevDateStr)

    // Check if opening stock already exists for this date
    const { data: existingOpeningStock } = await supabaseAdmin
      .from('opening_stock')
      .select('item_id')
      .eq('date', date)

    const existingItemIds = new Set(existingOpeningStock?.map((os) => os.item_id) || [])

    // Create opening stock records from previous day's closing stock
    const openingStockRecords = items
      .filter((item) => !existingItemIds.has(item.id)) // Only create if doesn't exist
      .map((item) => {
        const prevClosing = prevClosingStock?.find((cs) => cs.item_id === item.id)
        const prevOpening = prevOpeningStock?.find((os) => os.item_id === item.id)
        
        // Use previous day's closing stock if exists, otherwise use zero
        // Quantities only come from opening/closing stock - if not present, use zero
        const openingStock = prevClosing ? parseFloat(prevClosing.quantity.toString()) : 0
        
        // Use previous day's prices if available, otherwise use item's current prices
        const costPrice = prevOpening?.cost_price ?? item.cost_price
        const sellingPrice = prevOpening?.selling_price ?? item.selling_price

        return {
          item_id: item.id,
          quantity: openingStock,
          cost_price: costPrice,
          selling_price: sellingPrice,
          date,
          recorded_by: user_id,
          notes: prevClosing
            ? `Auto-created from previous day's closing stock (${prevDateStr})`
            : `Auto-created with zero quantity (no closing stock found for ${prevDateStr})`,
        }
      })

    if (openingStockRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: `Opening stock already exists for ${date}`,
        records_created: 0,
      })
    }

    // Insert opening stock records
    const { error: insertError } = await supabaseAdmin
      .from('opening_stock')
      .insert(openingStockRecords)

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Opening stock automatically created for ${date}`,
      records_created: openingStockRecords.length,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to auto-create opening stock'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

