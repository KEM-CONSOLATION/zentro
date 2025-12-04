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

    // Check if this is a past date
    const today = new Date().toISOString().split('T')[0]
    const isPastDate = date < today

    let availableStock = 0
    let stockInfo = ''

    if (isPastDate) {
      // For past dates: Opening Stock + Restocking - Sales (excluding this one)
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
        .neq('id', sale_id)

      const openingQty = openingStock ? parseFloat(openingStock.quantity.toString()) : 0
      const totalRestocking = restocking?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0
      const totalSalesExcludingThis = existingSales?.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0) || 0

      availableStock = openingQty + totalRestocking - totalSalesExcludingThis
      stockInfo = `Opening: ${openingQty}, Restocked: ${totalRestocking}, Sold: ${totalSalesExcludingThis}`
    } else {
      // For today: Current quantity - Other sales already made today
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
        .neq('id', sale_id)

      const totalSalesExcludingThis = existingSales?.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0) || 0

      availableStock = item.quantity - totalSalesExcludingThis
      stockInfo = `Current: ${item.quantity}, Sold today: ${totalSalesExcludingThis}`
    }

    if (availableStock <= 0) {
      return NextResponse.json(
        { error: `No available stock for ${date}. ${stockInfo}` },
        { status: 400 }
      )
    }

    if (parseFloat(quantity) > availableStock) {
      return NextResponse.json(
        { error: `Cannot update. Available stock: ${availableStock} (${stockInfo})` },
        { status: 400 }
      )
    }

    // Update sale record (DO NOT update item quantity - sales are tracked separately)
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

