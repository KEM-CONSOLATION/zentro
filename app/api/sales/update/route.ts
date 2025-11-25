import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function PUT(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const body = await request.json()
    const { sale_id, item_id, quantity, price_per_unit, total_price, payment_mode, date, description, old_quantity } = body

    if (!sale_id || !item_id || !quantity || !date || old_quantity === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get opening stock for the date (opening stock should remain constant)
    const { data: openingStock } = await supabaseAdmin
      .from('opening_stock')
      .select('quantity')
      .eq('item_id', item_id)
      .eq('date', date)
      .single()

    // Get total sales for the date excluding this sale
    const { data: existingSales } = await supabaseAdmin
      .from('sales')
      .select('quantity')
      .eq('item_id', item_id)
      .eq('date', date)
      .neq('id', sale_id)

    const totalSalesExcludingThis = existingSales?.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0) || 0
    const openingQty = openingStock?.quantity || 0

    // Validate new quantity doesn't exceed opening stock minus other sales
    const availableStock = openingQty - totalSalesExcludingThis
    if (parseFloat(quantity) > availableStock) {
      return NextResponse.json(
        { error: `Cannot update. Available stock: ${availableStock}` },
        { status: 400 }
      )
    }

    // Update sale record (DO NOT update item quantity - opening stock stays constant)
    const { error: saleError } = await supabaseAdmin
      .from('sales')
      .update({
        item_id,
        quantity: parseFloat(quantity),
        price_per_unit: parseFloat(price_per_unit) || 0,
        total_price: parseFloat(total_price) || 0,
        payment_mode: payment_mode || 'cash',
        date,
        description: description || null,
      })
      .eq('id', sale_id)

    if (saleError) {
      return NextResponse.json({ error: saleError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update sales'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

