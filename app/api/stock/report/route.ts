import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // Reject future dates
    const today = new Date().toISOString().split('T')[0]
    if (date > today) {
      return NextResponse.json({ error: 'Cannot generate reports for future dates' }, { status: 400 })
    }

    // Get all items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('items')
      .select('*')
      .order('name')

    if (itemsError || !items) {
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    // Calculate previous date - ensure we're working with date strings in YYYY-MM-DD format
    // Use local date calculation to avoid timezone issues
    const dateStr = date.split('T')[0] // Ensure YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: 'Invalid date format. Expected YYYY-MM-DD' }, { status: 400 })
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
    const { data: existingOpeningStock } = await supabaseAdmin
      .from('opening_stock')
      .select('item_id, quantity, cost_price, selling_price')
      .eq('date', date)

    // Get existing closing stock for this date (if manually entered)
    const { data: existingClosingStock } = await supabaseAdmin
      .from('closing_stock')
      .select('item_id, quantity')
      .eq('date', date)

    // Get previous day's closing stock
    const { data: prevClosingStock, error: closingStockError } = await supabaseAdmin
      .from('closing_stock')
      .select('item_id, quantity')
      .eq('date', prevDateStr)

    if (closingStockError) {
      // Error fetching previous closing stock - will fall back to item quantity
    }

    // Get sales for this date
    const { data: dateSales } = await supabaseAdmin
      .from('sales')
      .select('item_id, quantity')
      .eq('date', date)

    // Get restocking for this date
    const { data: dateRestocking } = await supabaseAdmin
      .from('restocking')
      .select('item_id, quantity')
      .eq('date', date)

    // Get waste/spoilage for this date
    const { data: dateWasteSpoilage } = await supabaseAdmin
      .from('waste_spoilage')
      .select('item_id, quantity')
      .eq('date', date)

    // Calculate opening and closing stock for each item
    const report = items.map((item) => {
      // Opening stock: ALWAYS use previous day's closing stock if available for consistency
      // Only fall back to manually entered opening stock if no previous closing stock exists
      // If neither exists, use zero (not item.quantity) - quantities are only from opening/closing stock
      const existingOpening = existingOpeningStock?.find((os) => os.item_id === item.id)
      const prevClosing = prevClosingStock?.find((cs) => cs.item_id === item.id)
      const openingStock = prevClosing
        ? parseFloat(prevClosing.quantity.toString()) // Always use previous day's closing stock if available
        : existingOpening
        ? parseFloat(existingOpening.quantity.toString())
        : 0 // Use zero if no opening/closing stock exists - quantities only come from stock system

      // Calculate total sales for this date
      const itemSales = dateSales?.filter((s) => s.item_id === item.id) || []
      const totalSales = itemSales.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0)

      // Calculate total restocking for this date
      const itemRestocking = dateRestocking?.filter((r) => r.item_id === item.id) || []
      const totalRestocking = itemRestocking.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0)

      // Calculate total waste/spoilage for this date
      const itemWasteSpoilage = dateWasteSpoilage?.filter((w) => w.item_id === item.id) || []
      const totalWasteSpoilage = itemWasteSpoilage.reduce((sum, w) => sum + parseFloat(w.quantity.toString()), 0)

      // Closing stock: Use existing record if manually entered, otherwise calculate
      // Formula: Opening + Restocking - Sales - Waste/Spoilage
      const existingClosing = existingClosingStock?.find((cs) => cs.item_id === item.id)
      const closingStock = existingClosing
        ? parseFloat(existingClosing.quantity.toString())
        : Math.max(0, openingStock + totalRestocking - totalSales - totalWasteSpoilage)

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

