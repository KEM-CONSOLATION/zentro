import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Seeds opening stock records for all past dates up to today
 * This allows the system to start fresh from today without manual entry
 * 
 * Strategy:
 * - For each item, use its current quantity as the opening stock for all past dates
 * - This creates a baseline so the system can work correctly from today forward
 * - Users can later adjust these values if needed
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const body = await request.json()
    const { user_id, start_date } = body

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    // Get today's date
    const today = new Date()
    const todayStr = formatDateLocal(today)

    // Use start_date if provided, otherwise use 30 days ago as default
    let startDate: Date
    if (start_date) {
      const dateStr = start_date.split('T')[0]
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return NextResponse.json({ error: 'Invalid start_date format. Expected YYYY-MM-DD' }, { status: 400 })
      }
      const [year, month, day] = dateStr.split('-').map(Number)
      startDate = new Date(year, month - 1, day)
    } else {
      // Default to 30 days ago
      startDate = new Date(today)
      startDate.setDate(startDate.getDate() - 30)
    }

    if (isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'Invalid start_date' }, { status: 400 })
    }

    // Get all items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('items')
      .select('*')
      .order('name')

    if (itemsError || !items) {
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'No items found. Please create items first.' }, { status: 400 })
    }

    // Generate all dates from start_date to today
    const dates: string[] = []
    const currentDate = new Date(startDate)
    
    while (formatDateLocal(currentDate) <= todayStr) {
      dates.push(formatDateLocal(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Check which opening stock records already exist
    const { data: existingOpeningStock } = await supabaseAdmin
      .from('opening_stock')
      .select('item_id, date')
      .in('date', dates)

    // Create a set of existing records for quick lookup
    const existingSet = new Set(
      existingOpeningStock?.map((os) => `${os.item_id}-${os.date}`) || []
    )

    // Prepare opening stock records to insert
    const openingStockRecords: Array<{
      item_id: string
      quantity: number
      date: string
      recorded_by: string
      cost_price: number
      selling_price: number
      notes: string
    }> = []

    for (const item of items) {
      for (const date of dates) {
        const key = `${item.id}-${date}`
        
        // Skip if record already exists
        if (existingSet.has(key)) {
          continue
        }

        openingStockRecords.push({
          item_id: item.id,
          quantity: 0, // Use zero - quantities should only come from opening/closing stock
          date: date,
          recorded_by: user_id,
          cost_price: item.cost_price,
          selling_price: item.selling_price,
          notes: `Auto-seeded opening stock with zero quantity. Please record actual opening stock for this date.`,
        })
      }
    }

    if (openingStockRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new opening stock records to create. All dates already have opening stock records.',
        records_created: 0,
        dates_processed: dates.length,
        items_processed: items.length,
      })
    }

    // Insert opening stock records in batches (Supabase has a limit of 1000 rows per insert)
    const BATCH_SIZE = 1000
    let totalInserted = 0

    for (let i = 0; i < openingStockRecords.length; i += BATCH_SIZE) {
      const batch = openingStockRecords.slice(i, i + BATCH_SIZE)
      
      const { error: insertError } = await supabaseAdmin
        .from('opening_stock')
        .insert(batch)

      if (insertError) {
        console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, insertError)
        return NextResponse.json(
          { error: `Failed to insert opening stock records: ${insertError.message}` },
          { status: 500 }
        )
      }

      totalInserted += batch.length
    }

    return NextResponse.json({
      success: true,
      message: `Successfully seeded opening stock for ${dates.length} date(s) and ${items.length} item(s)`,
      records_created: totalInserted,
      dates_processed: dates.length,
      items_processed: items.length,
      date_range: {
        start: formatDateLocal(startDate),
        end: todayStr,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to seed past dates'
    console.error('Error seeding past dates:', error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

/**
 * Format date to YYYY-MM-DD using local time (no timezone conversion)
 */
function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

