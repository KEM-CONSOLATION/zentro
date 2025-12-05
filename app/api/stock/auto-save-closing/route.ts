import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cascadeUpdateFromDate } from '@/lib/stock-cascade'

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

    // Reject future dates
    const today = new Date().toISOString().split('T')[0]
    if (date > today) {
      return NextResponse.json({ error: 'Cannot calculate closing stock for future dates' }, { status: 400 })
    }

    // Calculate previous date
    const dateObj = new Date(date + 'T00:00:00')
    const prevDate = new Date(dateObj)
    prevDate.setDate(prevDate.getDate() - 1)
    const prevDateStr = prevDate.toISOString().split('T')[0]

    // Get all items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('items')
      .select('*')
      .order('name')

    if (itemsError || !items) {
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    // Get previous day's closing stock (or use item quantity as fallback)
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
    const closingStockRecords = items.map((item) => {
      // Determine opening stock: use today's opening stock if exists, otherwise previous closing stock, otherwise item quantity
      const todayOpening = todayOpeningStock?.find((os) => os.item_id === item.id)
      const prevClosing = prevClosingStock?.find((cs) => cs.item_id === item.id)
      const openingStock = todayOpening
        ? parseFloat(todayOpening.quantity.toString())
        : prevClosing
        ? parseFloat(prevClosing.quantity.toString())
        : item.quantity

      // Calculate total sales for today
      const itemSales = todaySales?.filter((s) => s.item_id === item.id) || []
      const totalSales = itemSales.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0)

      // Calculate total restocking for today
      const itemRestocking = todayRestocking?.filter((r) => r.item_id === item.id) || []
      const totalRestocking = itemRestocking.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0)

      // Calculate total waste/spoilage for today
      const itemWasteSpoilage = todayWasteSpoilage?.filter((w) => w.item_id === item.id) || []
      const totalWasteSpoilage = itemWasteSpoilage.reduce((sum, w) => sum + parseFloat(w.quantity.toString()), 0)

      // Calculate closing stock = opening stock + restocking - sales - waste/spoilage
      const closingStock = Math.max(0, openingStock + totalRestocking - totalSales - totalWasteSpoilage)

      return {
        item_id: item.id,
        quantity: closingStock,
        date,
        recorded_by: user_id,
        notes: `Auto-calculated: Opening (${openingStock}) + Restocking (${totalRestocking}) - Sales (${totalSales}) - Waste/Spoilage (${totalWasteSpoilage})`,
      }
    })

    // Upsert closing stock records (update if exists, insert if not)
    const { error: upsertError } = await supabaseAdmin
      .from('closing_stock')
      .upsert(closingStockRecords, {
        onConflict: 'item_id,date',
      })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    // Trigger cascade update to sync opening stock for the next day
    try {
      await cascadeUpdateFromDate(date, user_id)
    } catch (error) {
      console.error('Cascade update failed after saving closing stock:', error)
      // Don't fail the request if cascade update fails
    }

    return NextResponse.json({
      success: true,
      message: `Closing stock automatically saved for ${date}`,
      records_saved: closingStockRecords.length,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to auto-save closing stock'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

