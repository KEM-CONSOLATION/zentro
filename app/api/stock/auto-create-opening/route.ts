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

    // Get user's organization/branch
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id, branch_id, role')
      .eq('id', user_id)
      .single()

    const organizationId = profile?.organization_id || null
    const branchId = profile?.role === 'admin' && !profile?.branch_id ? null : profile?.branch_id || null

    // Reject future dates
    const today = new Date().toISOString().split('T')[0]
    if (date > today) {
      return NextResponse.json(
        { error: 'Cannot create opening stock for future dates' },
        { status: 400 }
      )
    }

    // Calculate previous date
    const dateObj = new Date(date + 'T00:00:00')
    const prevDate = new Date(dateObj)
    prevDate.setDate(prevDate.getDate() - 1)
    const prevDateStr = prevDate.toISOString().split('T')[0]

    // Helper functions to add filters
    const addOrgFilter = (query: any) => (organizationId ? query.eq('organization_id', organizationId) : query)
    const addBranchFilter = (query: any) =>
      branchId !== null && branchId !== undefined ? query.eq('branch_id', branchId) : query

    // Get all items for this organization
    let itemsQuery = supabaseAdmin.from('items').select('*').order('name')
    itemsQuery = addBranchFilter(addOrgFilter(itemsQuery))

    const { data: items, error: itemsError } = await itemsQuery

    if (itemsError || !items) {
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    // Get previous day's closing stock
    let prevClosingStockQuery = supabaseAdmin
      .from('closing_stock')
      .select('item_id, quantity')
      .eq('date', prevDateStr)
    prevClosingStockQuery = addBranchFilter(addOrgFilter(prevClosingStockQuery))
    const { data: prevClosingStock } = await prevClosingStockQuery

    // Get latest restocking prices for each item (to use for next day's opening stock)
    // This ensures price changes from restocking are reflected in the next day
    let latestRestockingQuery = supabaseAdmin
      .from('restocking')
      .select('item_id, cost_price, selling_price, date')
      .lte('date', prevDateStr) // All restocking up to and including previous day
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    latestRestockingQuery = addBranchFilter(addOrgFilter(latestRestockingQuery))
    const { data: allRestockings } = await latestRestockingQuery

    // Group by item_id and get the most recent restocking for each item
    const latestRestockingByItem = new Map<
      string,
      { cost_price: number | null; selling_price: number | null }
    >()
    if (allRestockings) {
      allRestockings.forEach((restocking: any) => {
        if (!latestRestockingByItem.has(restocking.item_id)) {
          latestRestockingByItem.set(restocking.item_id, {
            cost_price: restocking.cost_price,
            selling_price: restocking.selling_price,
          })
        }
      })
    }

    // Check if opening stock already exists for this date
    let existingOpeningStockQuery = supabaseAdmin
      .from('opening_stock')
      .select('item_id')
      .eq('date', date)
    existingOpeningStockQuery = addBranchFilter(addOrgFilter(existingOpeningStockQuery))
    const { data: existingOpeningStock } = await existingOpeningStockQuery

    const existingItemIds = new Set(existingOpeningStock?.map(os => os.item_id) || [])

    // Get previous day's opening stock prices for all items (to preserve price history)
    let prevOpeningStockQuery = supabaseAdmin
      .from('opening_stock')
      .select('item_id, cost_price, selling_price')
      .eq('date', prevDateStr)
    prevOpeningStockQuery = addBranchFilter(addOrgFilter(prevOpeningStockQuery))
    const { data: prevOpeningStock } = await prevOpeningStockQuery

    // Create a map of previous day's opening stock prices by item_id
    const prevOpeningStockByItem = new Map<
      string,
      { cost_price: number | null; selling_price: number | null }
    >()
    if (prevOpeningStock) {
      prevOpeningStock.forEach((os: any) => {
        prevOpeningStockByItem.set(os.item_id, {
          cost_price: os.cost_price,
          selling_price: os.selling_price,
        })
      })
    }

    // Create opening stock records from previous day's closing stock
    const openingStockRecords = items
      .filter(item => !existingItemIds.has(item.id)) // Only create if doesn't exist
      .map(item => {
        const prevClosing = prevClosingStock?.find(cs => cs.item_id === item.id)
        const latestRestocking = latestRestockingByItem.get(item.id)
        const prevOpening = prevOpeningStockByItem.get(item.id)

        // Use previous day's closing stock if exists, otherwise use zero
        // Quantities only come from opening/closing stock - if not present, use zero
        const openingStock = prevClosing ? parseFloat(prevClosing.quantity.toString()) : 0

        // Use latest restocking price if available (price changes take effect on next day)
        // If no restocking price, use previous day's opening stock price to preserve price history
        // Only fall back to item's current price if neither exists (for new items)
        let costPrice: number | null = null
        let sellingPrice: number | null = null

        if (latestRestocking) {
          // Latest restocking price takes precedence (price changes take effect on next day)
          costPrice = latestRestocking.cost_price ?? null
          sellingPrice = latestRestocking.selling_price ?? null
        } else if (prevOpening) {
          // No restocking - use previous day's opening stock price to preserve price history
          costPrice = prevOpening.cost_price ?? null
          sellingPrice = prevOpening.selling_price ?? null
        } else {
          // Fall back to item's current price only if no previous opening stock exists
          costPrice = item.cost_price ?? null
          sellingPrice = item.selling_price ?? null
        }

        return {
          item_id: item.id,
          quantity: openingStock,
          cost_price: costPrice,
          selling_price: sellingPrice,
          date,
          recorded_by: user_id,
          organization_id: organizationId,
          branch_id: branchId,
          notes: prevClosing
            ? `Auto-created from previous day's closing stock (${prevDateStr})${latestRestocking ? ' with latest restocking prices' : ''}`
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
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to auto-create opening stock'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
