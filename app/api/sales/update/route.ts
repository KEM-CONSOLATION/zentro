import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recalculateClosingStock, cascadeUpdateFromDate } from '@/lib/stock-cascade'

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
    const {
      sale_id,
      item_id,
      quantity,
      price_per_unit,
      total_price,
      payment_mode,
      date,
      description,
      old_quantity,
      user_id,
      branch_id,
    } = body

    if (!sale_id || !item_id || !quantity || !date || old_quantity === undefined || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get user's organization/branch
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id, branch_id, role')
      .eq('id', user_id)
      .single()

    const organizationId = profile?.organization_id || null
    const effectiveBranchId =
      profile?.role === 'admin' && !profile?.branch_id ? branch_id || null : profile?.branch_id || null

    // Reject future dates
    const today = new Date().toISOString().split('T')[0]
    if (date > today) {
      return NextResponse.json({ error: 'Cannot update sales for future dates' }, { status: 400 })
    }

    // Check if this is a past date
    const isPastDate = date < today

    // Helper function to add organization filter
    const addOrgFilter = (query: any) => (organizationId ? query.eq('organization_id', organizationId) : query)
    const addBranchFilter = (query: any) =>
      effectiveBranchId !== null && effectiveBranchId !== undefined
        ? query.eq('branch_id', effectiveBranchId)
        : query

    let availableStock = 0
    let stockInfo = ''

    if (isPastDate) {
      // For past dates: Opening Stock + Restocking - Sales (excluding this one)
      let openingStockQuery = supabaseAdmin
        .from('opening_stock')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)
      openingStockQuery = addBranchFilter(addOrgFilter(openingStockQuery))
      const { data: openingStock } = await openingStockQuery.single()

      let restockingQuery = supabaseAdmin
        .from('restocking')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)
      restockingQuery = addBranchFilter(addOrgFilter(restockingQuery))
      const { data: restocking } = await restockingQuery

      let existingSalesQuery = supabaseAdmin
        .from('sales')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)
        .neq('id', sale_id)
      existingSalesQuery = addBranchFilter(addOrgFilter(existingSalesQuery))
      const { data: existingSales } = await existingSalesQuery

      const openingQty = openingStock ? parseFloat(openingStock.quantity.toString()) : 0
      const totalRestocking =
        restocking?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0
      const totalSalesExcludingThis =
        existingSales?.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0) || 0

      availableStock = openingQty + totalRestocking - totalSalesExcludingThis
      stockInfo = `Opening: ${openingQty}, Restocked: ${totalRestocking}, Sold: ${totalSalesExcludingThis}`
    } else {
      // For today: Opening Stock + Restocking - Other sales already made today
      // Quantities only come from opening/closing stock - not from item.quantity
      let openingStockQuery = supabaseAdmin
        .from('opening_stock')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)
      openingStockQuery = addBranchFilter(addOrgFilter(openingStockQuery))
      const { data: openingStock } = await openingStockQuery.single()

      let restockingQuery = supabaseAdmin
        .from('restocking')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)
      restockingQuery = addBranchFilter(addOrgFilter(restockingQuery))
      const { data: restocking } = await restockingQuery

      let existingSalesQuery = supabaseAdmin
        .from('sales')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)
        .neq('id', sale_id)
      existingSalesQuery = addBranchFilter(addOrgFilter(existingSalesQuery))
      const { data: existingSales } = await existingSalesQuery

      const openingQty = openingStock ? parseFloat(openingStock.quantity.toString()) : 0
      const totalRestocking =
        restocking?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0
      const totalSalesExcludingThis =
        existingSales?.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0) || 0

      availableStock = openingQty + totalRestocking - totalSalesExcludingThis
      stockInfo = `Opening: ${openingQty}, Restocked: ${totalRestocking}, Sold today: ${totalSalesExcludingThis}`
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
        organization_id: organizationId,
        branch_id: effectiveBranchId,
      })
      .eq('id', sale_id)

    if (saleError) {
      return NextResponse.json({ error: saleError.message }, { status: 500 })
    }

    // For past dates: Recalculate closing stock and cascade update opening stock for subsequent days
    if (isPastDate) {
      try {
        // Recalculate closing stock for this date
        await recalculateClosingStock(date, user_id, effectiveBranchId)

        // Cascade update opening stock for subsequent days
        await cascadeUpdateFromDate(date, user_id, effectiveBranchId)
      } catch (error) {
        console.error('Failed to cascade update after sale update:', error)
        // Don't fail the update if cascade update fails
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update sales'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
