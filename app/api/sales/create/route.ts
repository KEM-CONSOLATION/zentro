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
    const {
      item_id,
      quantity,
      price_per_unit,
      total_price,
      payment_mode,
      date,
      description,
      user_id,
      restocking_id,
      opening_stock_id,
      batch_label,
    } = body

    if (!item_id || !quantity || !date || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get user's organization_id and branch_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id, branch_id, role')
      .eq('id', user_id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const organization_id = profile.organization_id
    
    // Determine effective branch_id
    // Tenant admin (admin without fixed branch_id): can specify branch_id in request
    // Branch manager/staff: use fixed branch_id from profile
    const branch_id_from_request = body.branch_id
    const effective_branch_id =
      profile.role === 'admin' && !profile.branch_id
        ? branch_id_from_request || null // Tenant admin: can specify or null (all branches)
        : profile.branch_id // Branch manager/staff: fixed branch

    // Reject future dates
    const today = new Date().toISOString().split('T')[0]
    if (date > today) {
      return NextResponse.json({ error: 'Cannot record sales for future dates' }, { status: 400 })
    }

    // Check if this is a past date
    const isPastDate = date < today

    let availableStock = 0
    let stockInfo = ''

    if (restocking_id) {
      const { data: restocking } = await supabaseAdmin
        .from('restocking')
        .select('quantity, organization_id, branch_id')
        .eq('id', restocking_id)
        .single()

      if (!restocking) {
        return NextResponse.json({ error: 'Restocking batch not found' }, { status: 404 })
      }

      // Verify the restocking batch belongs to the user's organization
      if (restocking.organization_id && restocking.organization_id !== organization_id) {
        return NextResponse.json(
          { error: 'Restocking batch does not belong to your organization' },
          { status: 403 }
        )
      }

      // Verify branch_id matches if effective_branch_id is set
      if (effective_branch_id && restocking.branch_id && restocking.branch_id !== effective_branch_id) {
        return NextResponse.json(
          { error: 'Restocking batch does not belong to your branch' },
          { status: 403 }
        )
      }

      let existingSalesQuery = supabaseAdmin
        .from('sales')
        .select('quantity')
        .eq('restocking_id', restocking_id)
        .eq('date', date)
        .eq('organization_id', organization_id)
      if (effective_branch_id) {
        existingSalesQuery = existingSalesQuery.eq('branch_id', effective_branch_id)
      }
      const { data: existingSales } = await existingSalesQuery

      const restockQty = parseFloat(restocking.quantity.toString())
      const totalSalesSoFar =
        existingSales?.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0) || 0
      availableStock = Math.max(0, restockQty - totalSalesSoFar)
      stockInfo = `Restocked: ${restockQty}, Sold from this batch: ${totalSalesSoFar}`
    } else if (opening_stock_id) {
      const { data: openingStock } = await supabaseAdmin
        .from('opening_stock')
        .select('quantity, organization_id, branch_id')
        .eq('id', opening_stock_id)
        .single()

      if (!openingStock) {
        return NextResponse.json({ error: 'Opening stock batch not found' }, { status: 404 })
      }

      // Verify the opening stock batch belongs to the user's organization
      if (openingStock.organization_id && openingStock.organization_id !== organization_id) {
        return NextResponse.json(
          { error: 'Opening stock batch does not belong to your organization' },
          { status: 403 }
        )
      }

      // Verify branch_id matches if effective_branch_id is set
      if (effective_branch_id && openingStock.branch_id && openingStock.branch_id !== effective_branch_id) {
        return NextResponse.json(
          { error: 'Opening stock batch does not belong to your branch' },
          { status: 403 }
        )
      }

      let existingSalesQuery = supabaseAdmin
        .from('sales')
        .select('quantity')
        .eq('opening_stock_id', opening_stock_id)
        .eq('date', date)
        .eq('organization_id', organization_id)
      if (effective_branch_id) {
        existingSalesQuery = existingSalesQuery.eq('branch_id', effective_branch_id)
      }
      const { data: existingSales } = await existingSalesQuery

      const openingQty = parseFloat(openingStock.quantity.toString())
      const totalSalesSoFar =
        existingSales?.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0) || 0
      availableStock = openingQty - totalSalesSoFar
      stockInfo = `Opening: ${openingQty}, Sold from this batch: ${totalSalesSoFar}`
    } else if (isPastDate) {
      let openingStockQuery = supabaseAdmin
        .from('opening_stock')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)
        .eq('organization_id', organization_id)
      if (effective_branch_id) {
        openingStockQuery = openingStockQuery.eq('branch_id', effective_branch_id)
      }
      const { data: openingStock } = await openingStockQuery.single()

      let restockingQuery = supabaseAdmin
        .from('restocking')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)
        .eq('organization_id', organization_id)
      if (effective_branch_id) {
        restockingQuery = restockingQuery.eq('branch_id', effective_branch_id)
      }
      const { data: restocking } = await restockingQuery

      let existingSalesQuery = supabaseAdmin
        .from('sales')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)
        .eq('organization_id', organization_id)
      if (effective_branch_id) {
        existingSalesQuery = existingSalesQuery.eq('branch_id', effective_branch_id)
      }
      const { data: existingSales } = await existingSalesQuery

      const openingQty = openingStock ? parseFloat(openingStock.quantity.toString()) : 0
      const totalRestocking =
        restocking?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0
      const totalSalesSoFar =
        existingSales?.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0) || 0

      availableStock = openingQty + totalRestocking - totalSalesSoFar
      stockInfo = `Opening: ${openingQty}, Restocked: ${totalRestocking}, Sold: ${totalSalesSoFar}`
    } else {
      // For today: Opening Stock + Restocking - Sales already made today
      // Quantities only come from opening/closing stock - not from item.quantity
      let openingStockQuery = supabaseAdmin
        .from('opening_stock')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)
        .eq('organization_id', organization_id)
      if (effective_branch_id) {
        openingStockQuery = openingStockQuery.eq('branch_id', effective_branch_id)
      }
      const { data: openingStock } = await openingStockQuery.single()

      let restockingQuery = supabaseAdmin
        .from('restocking')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)
        .eq('organization_id', organization_id)
      if (effective_branch_id) {
        restockingQuery = restockingQuery.eq('branch_id', effective_branch_id)
      }
      const { data: restocking } = await restockingQuery

      let existingSalesQuery = supabaseAdmin
        .from('sales')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('date', date)
        .eq('organization_id', organization_id)
      if (effective_branch_id) {
        existingSalesQuery = existingSalesQuery.eq('branch_id', effective_branch_id)
      }
      const { data: existingSales } = await existingSalesQuery

      const openingQty = openingStock ? parseFloat(openingStock.quantity.toString()) : 0
      const totalRestocking =
        restocking?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0
      const totalSalesSoFar =
        existingSales?.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0) || 0

      availableStock = openingQty + totalRestocking - totalSalesSoFar
      stockInfo = `Opening: ${openingQty}, Restocked: ${totalRestocking}, Sold today: ${totalSalesSoFar}`
    }

    if (availableStock < parseFloat(quantity)) {
      // For batch-specific sales, show batch-specific error message
      if (restocking_id || opening_stock_id) {
        return NextResponse.json(
          {
            error: `Cannot record sales of ${quantity}. Available in this batch: ${availableStock}`,
          },
          { status: 400 }
        )
      }
      return NextResponse.json(
        {
          error: `Cannot record sales of ${quantity}. Available stock: ${availableStock} (${stockInfo})`,
        },
        { status: 400 }
      )
    }

    // Validate batch selection
    if (restocking_id && opening_stock_id) {
      return NextResponse.json(
        { error: 'Cannot specify both restocking_id and opening_stock_id' },
        { status: 400 }
      )
    }

    // Create sale record with batch tracking
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
        organization_id: organization_id,
        branch_id: effective_branch_id,
        description: description || null,
        restocking_id: restocking_id || null,
        opening_stock_id: opening_stock_id || null,
        batch_label: batch_label || null,
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
        await recalculateClosingStock(date, user_id, effective_branch_id)

        // Cascade update opening stock for subsequent days
        await cascadeUpdateFromDate(date, user_id, effective_branch_id)
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
