import { createClient } from '@supabase/supabase-js'

/**
 * Recalculates closing stock for a given date (only if not manually entered)
 */
export async function recalculateClosingStock(
  date: string,
  user_id: string,
  branchId?: string | null
) {
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
    throw new Error('Cannot calculate closing stock for future dates')
  }

  // Access environment variables inside the function to avoid issues when imported in client components
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Supabase configuration is missing. This function must be called from a server context.'
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // Get user's organization_id and branch_id
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id, branch_id, role')
      .eq('id', user_id)
      .single()

    const organizationId = profile?.organization_id || null

    // Determine effective branch_id
    const effective_branch_id =
      profile?.role === 'admin' && !profile.branch_id
        ? branchId || null // Tenant admin: can specify
        : profile?.branch_id || null // Branch manager/staff: fixed

    // Get all items for this organization
    let itemsQuery = supabaseAdmin.from('items').select('*').order('name')

    if (organizationId) {
      itemsQuery = itemsQuery.eq('organization_id', organizationId)
    }

    const { data: items } = await itemsQuery

    if (!items) return

    // Calculate previous date using local time to avoid timezone issues
    const dateStr = date.split('T')[0] // Ensure YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD')
    }

    const [year, month, day] = dateStr.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day) // month is 0-indexed, use local time
    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid date')
    }

    // Subtract one day
    dateObj.setDate(dateObj.getDate() - 1)

    // Format back to YYYY-MM-DD without timezone conversion
    const prevYear = dateObj.getFullYear()
    const prevMonth = String(dateObj.getMonth() + 1).padStart(2, '0')
    const prevDay = String(dateObj.getDate()).padStart(2, '0')
    const prevDateStr = `${prevYear}-${prevMonth}-${prevDay}`

    // Helper function to add organization and branch filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addOrgBranchFilter = (query: any) => {
      if (organizationId) {
        query = query.eq('organization_id', organizationId)
      }
      if (effective_branch_id) {
        query = query.eq('branch_id', effective_branch_id)
      }
      return query
    }

    // Get previous day's closing stock
    let prevClosingStockQuery = supabaseAdmin
      .from('closing_stock')
      .select('item_id, quantity')
      .eq('date', prevDateStr)
    prevClosingStockQuery = addOrgBranchFilter(prevClosingStockQuery)
    const { data: prevClosingStock } = await prevClosingStockQuery

    // Get today's opening stock
    let todayOpeningStockQuery = supabaseAdmin
      .from('opening_stock')
      .select('item_id, quantity')
      .eq('date', date)
    todayOpeningStockQuery = addOrgBranchFilter(todayOpeningStockQuery)
    const { data: todayOpeningStock } = await todayOpeningStockQuery

    // Get today's sales
    let todaySalesQuery = supabaseAdmin.from('sales').select('item_id, quantity').eq('date', date)
    todaySalesQuery = addOrgBranchFilter(todaySalesQuery)
    const { data: todaySales } = await todaySalesQuery

    // Get today's restocking
    let todayRestockingQuery = supabaseAdmin
      .from('restocking')
      .select('item_id, quantity')
      .eq('date', date)
    todayRestockingQuery = addOrgBranchFilter(todayRestockingQuery)
    const { data: todayRestocking } = await todayRestockingQuery

    // Get today's waste/spoilage
    let todayWasteSpoilageQuery = supabaseAdmin
      .from('waste_spoilage')
      .select('item_id, quantity')
      .eq('date', date)
    todayWasteSpoilageQuery = addOrgBranchFilter(todayWasteSpoilageQuery)
    const { data: todayWasteSpoilage } = await todayWasteSpoilageQuery

    // Filter items by organization_id if specified
    const filteredItems = organizationId
      ? items.filter(item => item.organization_id === organizationId)
      : items

    // Calculate and save closing stock for each item
    // This ensures consistency: Closing Stock = Opening + Restocking - Sales - Waste/Spoilage
    const closingStockRecords = filteredItems.map(item => {
      // Determine opening stock
      // Quantities only come from opening/closing stock - if not present, use zero
      const todayOpening = todayOpeningStock?.find(os => os.item_id === item.id)
      const prevClosing = prevClosingStock?.find(cs => cs.item_id === item.id)
      const openingStock = todayOpening
        ? parseFloat(todayOpening.quantity.toString())
        : prevClosing
          ? parseFloat(prevClosing.quantity.toString())
          : 0 // Use zero if no opening/closing stock exists

      // Calculate totals
      const itemSales = todaySales?.filter(s => s.item_id === item.id) || []
      const totalSales = itemSales.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0)

      const itemRestocking = todayRestocking?.filter(r => r.item_id === item.id) || []
      const totalRestocking = itemRestocking.reduce(
        (sum, r) => sum + parseFloat(r.quantity.toString()),
        0
      )

      const itemWasteSpoilage = todayWasteSpoilage?.filter(w => w.item_id === item.id) || []
      const totalWasteSpoilage = itemWasteSpoilage.reduce(
        (sum, w) => sum + parseFloat(w.quantity.toString()),
        0
      )

      // Calculate closing stock
      const closingStock = Math.max(
        0,
        openingStock + totalRestocking - totalSales - totalWasteSpoilage
      )

      return {
        item_id: item.id,
        quantity: closingStock,
        date,
        recorded_by: user_id,
        organization_id: organizationId,
        branch_id: effective_branch_id,
        notes: `Auto-calculated: Opening (${openingStock}) + Restocking (${totalRestocking}) - Sales (${totalSales}) - Waste/Spoilage (${totalWasteSpoilage})`,
      }
    })

    if (closingStockRecords.length > 0) {
      // Upsert closing stock records
      await supabaseAdmin.from('closing_stock').upsert(closingStockRecords, {
        onConflict: 'item_id,date,organization_id,branch_id',
      })
    }
  } catch (error) {
    console.error('Failed to recalculate closing stock:', error)
  }
}

/**
 * Cascades stock updates from a given date forward
 * When closing stock changes for a date, it updates opening stock for the next day
 * This continues until we reach today or a manually entered opening stock
 */
export async function cascadeUpdateFromDate(
  start_date: string,
  user_id: string,
  branchId?: string | null
) {
  // Normalize date format to YYYY-MM-DD (handle any format variations)
  if (start_date.includes('T')) {
    start_date = start_date.split('T')[0]
  } else if (start_date.includes('/')) {
    const parts = start_date.split('/')
    if (parts.length === 3) {
      // DD/MM/YYYY to YYYY-MM-DD
      start_date = `${parts[2]}-${parts[1]}-${parts[0]}`
    }
  }

  // Reject future dates
  const today = new Date().toISOString().split('T')[0]
  if (start_date > today) {
    throw new Error('Cannot cascade update from future dates')
  }

  // Access environment variables inside the function to avoid issues when imported in client components
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Supabase configuration is missing. This function must be called from a server context.'
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Get user's organization_id and branch_id
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('organization_id, branch_id, role')
    .eq('id', user_id)
    .single()

  const organizationId = profile?.organization_id || null

  // Determine effective branch_id
  const effective_branch_id =
    profile?.role === 'admin' && !profile.branch_id
      ? branchId || null // Tenant admin: can specify
      : profile?.branch_id || null // Branch manager/staff: fixed

  // Parse start_date using local time to avoid timezone issues
  const startDateStr = start_date.split('T')[0] // Ensure YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
    throw new Error('Invalid start_date format. Expected YYYY-MM-DD')
  }

  const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number)
  let currentDate = new Date(startYear, startMonth - 1, startDay) // month is 0-indexed, use local time
  if (isNaN(currentDate.getTime())) {
    throw new Error('Invalid start_date')
  }

  const updates: string[] = []

  // Format date to YYYY-MM-DD for comparison (using local time)
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Cascade updates from start_date forward until today
  while (formatDateLocal(currentDate) < today) {
    const currentDateStr = formatDateLocal(currentDate)

    // Calculate next date
    const nextDate = new Date(currentDate)
    nextDate.setDate(nextDate.getDate() + 1)
    const nextDateStr = formatDateLocal(nextDate)

    // Helper function to add organization and branch filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addOrgBranchFilter = (query: any) => {
      if (organizationId) {
        query = query.eq('organization_id', organizationId)
      }
      if (effective_branch_id) {
        query = query.eq('branch_id', effective_branch_id)
      }
      return query
    }

    // Get closing stock for current date
    let closingStockQuery = supabaseAdmin
      .from('closing_stock')
      .select('item_id, quantity')
      .eq('date', currentDateStr)
    closingStockQuery = addOrgBranchFilter(closingStockQuery)
    const { data: closingStock } = await closingStockQuery

    if (!closingStock || closingStock.length === 0) {
      // No closing stock for this date, move to next day
      currentDate = nextDate
      continue
    }

    // Get opening stock prices from current date to carry forward
    let currentOpeningStockQuery = supabaseAdmin
      .from('opening_stock')
      .select('item_id, cost_price, selling_price')
      .eq('date', currentDateStr)
    currentOpeningStockQuery = addOrgBranchFilter(currentOpeningStockQuery)
    const { data: currentOpeningStock } = await currentOpeningStockQuery

    // Note: We'll fetch existing opening stock with prices below to preserve them

    // Get all items for this organization
    let itemsQuery = supabaseAdmin.from('items').select('*').order('name')

    if (organizationId) {
      itemsQuery = itemsQuery.eq('organization_id', organizationId)
    }

    const { data: items } = await itemsQuery

    if (!items) {
      currentDate = nextDate
      continue
    }

    // Get existing opening stock prices for next date to preserve them
    let existingNextOpeningStockWithPricesQuery = supabaseAdmin
      .from('opening_stock')
      .select('item_id, quantity, cost_price, selling_price')
      .eq('date', nextDateStr)
    existingNextOpeningStockWithPricesQuery = addOrgBranchFilter(existingNextOpeningStockWithPricesQuery)
    const { data: existingNextOpeningStockWithPrices } =
      await existingNextOpeningStockWithPricesQuery

    // Update/create opening stock for next date based on current date's closing stock
    // ALWAYS update to match previous day's closing stock for consistency
    const openingStockToUpsert = items
      .filter(item => {
        const hasClosingStock = closingStock.some(cs => cs.item_id === item.id)
        return hasClosingStock
      })
      .map(item => {
        const closing = closingStock.find(cs => cs.item_id === item.id)
        const currentOpening = currentOpeningStock?.find(os => os.item_id === item.id)
        const existingOpening = existingNextOpeningStockWithPrices?.find(
          os => os.item_id === item.id
        )

        // ALWAYS use closing stock quantity as opening stock for next day
        // This ensures consistency: closing stock of one day = opening stock of next day
        // If no closing stock, use zero (quantities only come from opening/closing stock)
        const openingQty = closing ? parseFloat(closing.quantity.toString()) : 0

        // CRITICAL: Preserve existing prices if opening stock already exists
        // Only set prices when creating NEW records, using current date's opening stock prices
        // This prevents restocking price changes from affecting past dates
        let costPrice: number | null | undefined
        let sellingPrice: number | null | undefined

        if (existingOpening) {
          // Preserve existing prices - never update prices of existing opening stock
          costPrice = existingOpening.cost_price
          sellingPrice = existingOpening.selling_price
        } else {
          // Only set prices when creating NEW opening stock
          // Use current date's opening stock prices, or null if not available
          // Do NOT use item's current price as fallback to prevent restocking price changes from affecting past dates
          costPrice = currentOpening?.cost_price ?? null
          sellingPrice = currentOpening?.selling_price ?? null
        }

        // Determine if this is an update or new entry
        const isUpdate = existingOpening && existingOpening.quantity !== openingQty
        const notes = closing
          ? isUpdate
            ? `Auto-updated from previous day's closing stock (${currentDateStr}). Previous value: ${existingOpening?.quantity || 'N/A'}`
            : `Auto-created from previous day's closing stock (${currentDateStr})`
          : `Auto-created from item quantity`

        return {
          item_id: item.id,
          quantity: openingQty,
          cost_price: costPrice,
          selling_price: sellingPrice,
          date: nextDateStr,
          recorded_by: user_id,
          organization_id: organizationId,
          branch_id: effective_branch_id,
          notes,
        }
      })

    if (openingStockToUpsert.length > 0) {
      // Upsert opening stock for next date
      const { error: upsertError } = await supabaseAdmin
        .from('opening_stock')
        .upsert(openingStockToUpsert, {
          onConflict: 'item_id,date,organization_id,branch_id',
        })

      if (!upsertError) {
        updates.push(
          `Updated opening stock for ${nextDateStr} from ${currentDateStr} closing stock`
        )

        // Recalculate closing stock for next date to maintain chain
        await recalculateClosingStock(nextDateStr, user_id, effective_branch_id)
      }
    }

    // Move to next date
    currentDate = nextDate
  }

  return { updates }
}
