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
    const { item_id, quantity, price_per_unit, total_price, payment_mode, date, description, user_id } = body

    if (!item_id || !quantity || !date || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get opening stock for the date (opening stock should remain constant)
    const { data: openingStock } = await supabaseAdmin
      .from('opening_stock')
      .select('quantity')
      .eq('item_id', item_id)
      .eq('date', date)
      .single()

    // Get total sales for the date so far
    const { data: existingSales } = await supabaseAdmin
      .from('sales')
      .select('quantity')
      .eq('item_id', item_id)
      .eq('date', date)

    const totalSalesSoFar = existingSales?.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0) || 0
    const openingQty = openingStock?.quantity || 0

    // Validate quantity doesn't exceed opening stock minus sales already made
    const availableStock = openingQty - totalSalesSoFar
    if (parseFloat(quantity) > availableStock) {
      return NextResponse.json(
        { error: `Cannot record sales of ${quantity}. Available stock: ${availableStock}` },
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

    return NextResponse.json({ success: true, sale })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to record sales'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

