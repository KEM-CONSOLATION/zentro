import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recalculateClosingStock, cascadeUpdateFromDate } from '@/lib/stock-cascade'

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
    const { item_id, quantity, price_per_unit, total_price, payment_mode, date, description, user_id } = body

    if (!item_id || !quantity || !date || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Reject future dates
    const today = new Date().toISOString().split('T')[0]
    if (date > today) {
      return NextResponse.json({ error: 'Cannot record sales for future dates' }, { status: 400 })
    }

    // Check if this is a past date
    const isPastDate = date < today

    let availableStock = 0
    let stockInfo = ''

    if (isPastDate) {
      // For past dates: Opening Stock + Restocking - Sales already recorded
      const { data: openingStock } = await supabaseAdmin
        .from('opening_stock')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)
        .single()

      const { data: restocking } = await supabaseAdmin
        .from('restocking')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)

      const { data: existingSales } = await supabaseAdmin
        .from('sales')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)

      const openingQty = openingStock ? parseFloat(openingStock.quantity.toString()) : 0
      const totalRestocking = restocking?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0
      const totalSalesSoFar = existingSales?.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0) || 0

      availableStock = openingQty + totalRestocking - totalSalesSoFar
      stockInfo = `Opening: ${openingQty}, Restocked: ${totalRestocking}, Sold: ${totalSalesSoFar}`
    } else {
      // For today: Current quantity - Sales already made today
      const { data: item, error: itemError } = await supabaseAdmin
        .from('items')
        .select('quantity')
        .eq('id', item_id)
        .single()

      if (itemError || !item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 })
      }

      const { data: existingSales } = await supabaseAdmin
        .from('sales')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)

      const totalSalesSoFar = existingSales?.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0) || 0

      availableStock = item.quantity - totalSalesSoFar
      stockInfo = `Current: ${item.quantity}, Sold today: ${totalSalesSoFar}`
    }

    if (availableStock <= 0) {
      return NextResponse.json(
        { error: `No available stock for ${date}. ${stockInfo}` },
        { status: 400 }
      )
    }

    if (parseFloat(quantity) > availableStock) {
      return NextResponse.json(
        { error: `Cannot record sales of ${quantity}. Available stock: ${availableStock} (${stockInfo})` },
        { status: 400 }
      )
    }

    // Create sale record (DO NOT update item quantity - opening stock stays constant)
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .insert({
        item_id,
        quantity: parseFloat(quantity),
        price_per_unit: parseFloat(price_per_unit) || 0,
        total_price: parseFloat(total_price) || 0,
        payment_mode: payment_mode || 'cash',
        date,
        recorded_by: user_id,
        description: description || null,
      })
      .select()
      .single()

    if (saleError) {
      return NextResponse.json({ error: saleError.message }, { status: 500 })
    }

    // For past dates: Recalculate closing stock and cascade update opening stock for subsequent days
    if (isPastDate) {
      try {
        // Recalculate closing stock for this date
        await recalculateClosingStock(date, user_id)
        
        // Cascade update opening stock for subsequent days
        await cascadeUpdateFromDate(date, user_id)
      } catch (error) {
        console.error('Failed to cascade update after sale:', error)
        // Don't fail the sale if cascade update fails
      }
    }

    return NextResponse.json({ success: true, sale })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to record sales'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

