import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get authenticated user from session
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { searchParams } = new URL(request.url)
    let date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const branchParam = searchParams.get('branch_id') // Allow branch to be passed as parameter

    // Normalize date format to YYYY-MM-DD (handle any format variations)
    if (date.includes('T')) {
      date = date.split('T')[0]
    } else if (date.includes('/')) {
      const parts = date.split('/')
      if (parts.length === 3) {
        // DD/MM/YYYY to YYYY-MM-DD
        date = `${parts[2]}-${parts[1]}-${parts[0]}`
      }
    }

    // Reject future dates
    const today = new Date().toISOString().split('T')[0]
    if (date > today) {
      return NextResponse.json(
        { error: 'Cannot generate reports for future dates' },
        { status: 400 }
      )
    }

    // Get user's organization_id/branch_id from authenticated session
    let organizationId: string | null = null
    let branchId: string | null = null
    if (user) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('organization_id, branch_id, role')
        .eq('id', user.id)
        .single()
      organizationId = profile?.organization_id || null
      
      // Use branch from parameter if provided (for tenant admins with branch selector)
      // Otherwise use profile.branch_id, or null for tenant admins without assigned branch
      if (branchParam) {
        branchId = branchParam
      } else {
        branchId =
          profile?.role === 'admin' && !profile?.branch_id
            ? null // tenant admin can view all branches
            : profile?.branch_id || null
      }
    }

    // Helper functions to add filters
    const addOrgFilter = (query: any) =>
      organizationId ? query.eq('organization_id', organizationId) : query
    const addBranchFilter = (query: any) =>
      branchId !== null && branchId !== undefined ? query.eq('branch_id', branchId) : query

    // Get items - filter by organization_id/branch_id if available
    let itemsQuery = supabaseAdmin.from('items').select('*').order('name')
    itemsQuery = addBranchFilter(addOrgFilter(itemsQuery))

    const { data: items, error: itemsError } = await itemsQuery

    if (itemsError || !items) {
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    // Calculate previous date - ensure we're working with date strings in YYYY-MM-DD format
    // Use local date calculation to avoid timezone issues
    const dateStr = date.split('T')[0] // Ensure YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json(
        { error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const [year, month, day] = dateStr.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day) // month is 0-indexed, use local time
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    // Subtract one day
    dateObj.setDate(dateObj.getDate() - 1)

    // Format back to YYYY-MM-DD without timezone conversion
    const prevYear = dateObj.getFullYear()
    const prevMonth = String(dateObj.getMonth() + 1).padStart(2, '0')
    const prevDay = String(dateObj.getDate()).padStart(2, '0')
    const prevDateStr = `${prevYear}-${prevMonth}-${prevDay}`

    // Get existing opening stock for this date (if manually entered)
    let openingStockQuery = supabaseAdmin
      .from('opening_stock')
      .select('item_id, quantity, cost_price, selling_price')
      .eq('date', date)
    openingStockQuery = addBranchFilter(addOrgFilter(openingStockQuery))
    const { data: existingOpeningStock } = await openingStockQuery

    // Get existing closing stock for this date (if manually entered)
    let closingStockQuery = supabaseAdmin
      .from('closing_stock')
      .select('item_id, quantity')
      .eq('date', date)
    closingStockQuery = addBranchFilter(addOrgFilter(closingStockQuery))
    const { data: existingClosingStock } = await closingStockQuery

    // Get previous day's closing stock
    let prevClosingStockQuery = supabaseAdmin
      .from('closing_stock')
      .select('item_id, quantity')
      .eq('date', prevDateStr)
    prevClosingStockQuery = addBranchFilter(addOrgFilter(prevClosingStockQuery))
    const { data: prevClosingStock, error: closingStockError } = await prevClosingStockQuery

    if (closingStockError) {
      // Error fetching previous closing stock - will fall back to item quantity
    }

    // Get sales for this date
    let salesQuery = supabaseAdmin.from('sales').select('item_id, quantity').eq('date', date)
    salesQuery = addBranchFilter(addOrgFilter(salesQuery))
    const { data: dateSales } = await salesQuery

    // Get restocking for this date
    let restockingQuery = supabaseAdmin
      .from('restocking')
      .select('item_id, quantity')
      .eq('date', date)
    restockingQuery = addBranchFilter(addOrgFilter(restockingQuery))
    const { data: dateRestocking } = await restockingQuery

    // Get waste/spoilage for this date
    let wasteSpoilageQuery = supabaseAdmin
      .from('waste_spoilage')
      .select('item_id, quantity')
      .eq('date', date)
    wasteSpoilageQuery = addBranchFilter(addOrgFilter(wasteSpoilageQuery))
    const { data: dateWasteSpoilage } = await wasteSpoilageQuery

    // Transfers (branch-aware): outgoing and incoming
    let outgoingTransfersQuery = supabaseAdmin
      .from('branch_transfers')
      .select('item_id, quantity')
      .eq('date', date)
    outgoingTransfersQuery = addOrgFilter(outgoingTransfersQuery)
    if (branchId) {
      outgoingTransfersQuery = outgoingTransfersQuery.eq('from_branch_id', branchId)
    }
    const { data: outgoingTransfers } = await outgoingTransfersQuery

    let incomingTransfersQuery = supabaseAdmin
      .from('branch_transfers')
      .select('item_id, quantity')
      .eq('date', date)
    incomingTransfersQuery = addOrgFilter(incomingTransfersQuery)
    if (branchId) {
      incomingTransfersQuery = incomingTransfersQuery.eq('to_branch_id', branchId)
    }
    const { data: incomingTransfers } = await incomingTransfersQuery

    // Filter items by organization_id if specified
    const filteredItems = items

    // Calculate opening and closing stock for each item
    const report = filteredItems.map(item => {
      // Opening stock: ALWAYS use previous day's closing stock if available for consistency
      // Only fall back to manually entered opening stock if no previous closing stock exists
      // If neither exists, use zero (not item.quantity) - quantities are only from opening/closing stock
      const existingOpening = existingOpeningStock?.find(os => os.item_id === item.id)
      const prevClosing = prevClosingStock?.find(cs => cs.item_id === item.id)
      const openingStock = prevClosing
        ? parseFloat(prevClosing.quantity.toString()) // Always use previous day's closing stock if available
        : existingOpening
          ? parseFloat(existingOpening.quantity.toString())
          : 0 // Use zero if no opening/closing stock exists - quantities only come from stock system

      // Calculate total sales for this date
      const itemSales = dateSales?.filter(s => s.item_id === item.id) || []
      const totalSales = itemSales.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0)

      // Calculate total restocking for this date
      const itemRestocking = dateRestocking?.filter(r => r.item_id === item.id) || []
      const totalRestocking = itemRestocking.reduce(
        (sum, r) => sum + parseFloat(r.quantity.toString()),
        0
      )

      // Transfers
      const itemOutgoing = outgoingTransfers?.filter(t => t.item_id === item.id) || []
      const totalOutgoing = itemOutgoing.reduce(
        (sum, t) => sum + parseFloat(t.quantity.toString()),
        0
      )

      const itemIncoming = incomingTransfers?.filter(t => t.item_id === item.id) || []
      const totalIncoming = itemIncoming.reduce(
        (sum, t) => sum + parseFloat(t.quantity.toString()),
        0
      )

      // Calculate total waste/spoilage for this date
      const itemWasteSpoilage = dateWasteSpoilage?.filter(w => w.item_id === item.id) || []
      const totalWasteSpoilage = itemWasteSpoilage.reduce(
        (sum, w) => sum + parseFloat(w.quantity.toString()),
        0
      )

      // Closing stock: ALWAYS calculate from formula (Opening + Restocking + IncomingTransfers - Sales - Waste/Spoilage - OutgoingTransfers)
      // This ensures accuracy even if there's an existing record with incorrect data
      // The existingClosing flag is kept for UI purposes (to show if it was manually entered)
      const existingClosing = existingClosingStock?.find(cs => cs.item_id === item.id)
      // Always calculate closing stock from the formula for accuracy
      const closingStock = Math.max(
        0,
        openingStock +
          totalRestocking +
          totalIncoming -
          totalSales -
          totalWasteSpoilage -
          totalOutgoing
      )

      return {
        item_id: item.id,
        item_name: item.name,
        item_unit: item.unit,
        current_quantity: 0, // Always zero - quantities only come from opening/closing stock
        opening_stock: openingStock,
        opening_stock_source: existingOpening
          ? 'manual_entry'
          : prevClosing
            ? 'previous_closing_stock'
            : 'zero', // No previous closing stock - using zero (quantities only come from opening/closing stock)
        opening_stock_cost_price: existingOpening?.cost_price ?? null,
        opening_stock_selling_price: existingOpening?.selling_price ?? null,
        restocking: totalRestocking,
        transfers_in: totalIncoming,
        transfers_out: totalOutgoing,
        sales: totalSales,
        waste_spoilage: totalWasteSpoilage,
        closing_stock: closingStock,
        opening_stock_manual: !!existingOpening,
        closing_stock_manual: !!existingClosing,
      }
    })

    return NextResponse.json({ success: true, date, report })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate report'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
