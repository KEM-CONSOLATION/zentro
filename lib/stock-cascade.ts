import { createClient } from '@supabase/supabase-js'

/**
 * Recalculates closing stock for a given date (only if not manually entered)
 */
export async function recalculateClosingStock(
  date: string,
  user_id: string
) {
  // Reject future dates
  const today = new Date().toISOString().split('T')[0]
  if (date > today) {
    throw new Error('Cannot calculate closing stock for future dates')
  }

  // Access environment variables inside the function to avoid issues when imported in client components
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration is missing. This function must be called from a server context.')
  }
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // Get all items
    const { data: items } = await supabaseAdmin
      .from('items')
      .select('*')
      .order('name')

    if (!items) return

    // Calculate previous date
    const dateObj = new Date(date + 'T00:00:00')
    const prevDate = new Date(dateObj)
    prevDate.setDate(prevDate.getDate() - 1)
    const prevDateStr = prevDate.toISOString().split('T')[0]

    // Get previous day's closing stock
    const { data: prevClosingStock } = await supabaseAdmin
      .from('closing_stock')
      .select('item_id, quantity')
      .eq('date', prevDateStr)

    // Get today's opening stock
    const { data: todayOpeningStock } = await supabaseAdmin
      .from('opening_stock')
      .select('item_id, quantity')
      .eq('date', date)

    // Get today's sales
    const { data: todaySales } = await supabaseAdmin
      .from('sales')
      .select('item_id, quantity')
      .eq('date', date)

    // Get today's restocking
    const { data: todayRestocking } = await supabaseAdmin
      .from('restocking')
      .select('item_id, quantity')
      .eq('date', date)

    // Get today's waste/spoilage
    const { data: todayWasteSpoilage } = await supabaseAdmin
      .from('waste_spoilage')
      .select('item_id, quantity')
      .eq('date', date)

    // Calculate and save closing stock for each item
    // Note: This function recalculates ALL items based on the formula, even if manually entered
    // This ensures consistency: Closing Stock = Opening + Restocking - Sales - Waste/Spoilage
    const closingStockRecords = items.map((item) => {
        // Determine opening stock
        const todayOpening = todayOpeningStock?.find((os) => os.item_id === item.id)
        const prevClosing = prevClosingStock?.find((cs) => cs.item_id === item.id)
        const openingStock = todayOpening
          ? parseFloat(todayOpening.quantity.toString())
          : prevClosing
          ? parseFloat(prevClosing.quantity.toString())
          : item.quantity

        // Calculate totals
        const itemSales = todaySales?.filter((s) => s.item_id === item.id) || []
        const totalSales = itemSales.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0)

        const itemRestocking = todayRestocking?.filter((r) => r.item_id === item.id) || []
        const totalRestocking = itemRestocking.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0)

        const itemWasteSpoilage = todayWasteSpoilage?.filter((w) => w.item_id === item.id) || []
        const totalWasteSpoilage = itemWasteSpoilage.reduce((sum, w) => sum + parseFloat(w.quantity.toString()), 0)

        // Calculate closing stock
        const closingStock = Math.max(0, openingStock + totalRestocking - totalSales - totalWasteSpoilage)

        return {
          item_id: item.id,
          quantity: closingStock,
          date,
          recorded_by: user_id,
          notes: `Auto-calculated: Opening (${openingStock}) + Restocking (${totalRestocking}) - Sales (${totalSales}) - Waste/Spoilage (${totalWasteSpoilage})`,
        }
      })

    if (closingStockRecords.length > 0) {
      // Upsert closing stock records
      await supabaseAdmin
        .from('closing_stock')
        .upsert(closingStockRecords, {
          onConflict: 'item_id,date',
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
export async function cascadeUpdateFromDate(start_date: string, user_id: string) {
  // Reject future dates
  const today = new Date().toISOString().split('T')[0]
  if (start_date > today) {
    throw new Error('Cannot cascade update from future dates')
  }

  // Access environment variables inside the function to avoid issues when imported in client components
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration is missing. This function must be called from a server context.')
  }
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  let currentDate = new Date(start_date + 'T00:00:00')
  const updates: string[] = []

  // Cascade updates from start_date forward until today
  while (currentDate.toISOString().split('T')[0] < today) {
    const currentDateStr = currentDate.toISOString().split('T')[0]
    
    // Calculate next date
    const nextDate = new Date(currentDate)
    nextDate.setDate(nextDate.getDate() + 1)
    const nextDateStr = nextDate.toISOString().split('T')[0]

    // Get closing stock for current date
    const { data: closingStock } = await supabaseAdmin
      .from('closing_stock')
      .select('item_id, quantity')
      .eq('date', currentDateStr)

    if (!closingStock || closingStock.length === 0) {
      // No closing stock for this date, move to next day
      currentDate = nextDate
      continue
    }

    // Get opening stock prices from current date to carry forward
    const { data: currentOpeningStock } = await supabaseAdmin
      .from('opening_stock')
      .select('item_id, cost_price, selling_price')
      .eq('date', currentDateStr)

    // Check if opening stock already exists for next date (manually entered)
    const { data: existingNextOpeningStock } = await supabaseAdmin
      .from('opening_stock')
      .select('item_id, quantity')
      .eq('date', nextDateStr)

    const existingItemIds = new Set(existingNextOpeningStock?.map((os) => os.item_id) || [])

    // Get all items
    const { data: items } = await supabaseAdmin
      .from('items')
      .select('*')
      .order('name')

    if (!items) {
      currentDate = nextDate
      continue
    }

    // Update/create opening stock for next date based on current date's closing stock
    // ALWAYS update to match previous day's closing stock for consistency
    const openingStockToUpsert = items
      .filter((item) => {
        const hasClosingStock = closingStock.some((cs) => cs.item_id === item.id)
        return hasClosingStock
      })
      .map((item) => {
        const closing = closingStock.find((cs) => cs.item_id === item.id)
        const currentOpening = currentOpeningStock?.find((os) => os.item_id === item.id)
        const existingOpening = existingNextOpeningStock?.find((os) => os.item_id === item.id)
        
        // ALWAYS use closing stock quantity as opening stock for next day
        // This ensures consistency: closing stock of one day = opening stock of next day
        const openingQty = closing ? parseFloat(closing.quantity.toString()) : item.quantity
        
        // Use prices from current date's opening stock, or item's current prices
        const costPrice = currentOpening?.cost_price ?? item.cost_price
        const sellingPrice = currentOpening?.selling_price ?? item.selling_price

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
          notes,
        }
      })

    if (openingStockToUpsert.length > 0) {
      // Upsert opening stock for next date
      const { error: upsertError } = await supabaseAdmin
        .from('opening_stock')
        .upsert(openingStockToUpsert, {
          onConflict: 'item_id,date',
        })

      if (!upsertError) {
        updates.push(`Updated opening stock for ${nextDateStr} from ${currentDateStr} closing stock`)
        
        // Recalculate closing stock for next date to maintain chain
        await recalculateClosingStock(nextDateStr, user_id)
      }
    }

    // Move to next date
    currentDate = nextDate
  }

  return { updates }
}

