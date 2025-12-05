import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Deletes all stock-related data (opening stock, closing stock, sales, restocking, waste/spoilage)
 * This allows starting fresh with new data entry
 */
export async function POST() {
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Delete all stock-related data
    const deletions = await Promise.all([
      supabaseAdmin.from('waste_spoilage').delete().neq('id', '00000000-0000-0000-0000-000000000000'), // Delete all
      supabaseAdmin.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000'), // Delete all
      supabaseAdmin.from('restocking').delete().neq('id', '00000000-0000-0000-0000-000000000000'), // Delete all
      supabaseAdmin.from('closing_stock').delete().neq('id', '00000000-0000-0000-0000-000000000000'), // Delete all
      supabaseAdmin.from('opening_stock').delete().neq('id', '00000000-0000-0000-0000-000000000000'), // Delete all
    ])

    // Check for errors
    const errors = deletions.filter((result) => result.error)
    if (errors.length > 0) {
      const errorMessages = errors.map((e) => e.error?.message).filter(Boolean)
      return NextResponse.json(
        { error: `Failed to delete some data: ${errorMessages.join(', ')}` },
        { status: 500 }
      )
    }

    // Also reset all item quantities to zero
    const { data: items } = await supabaseAdmin.from('items').select('id')
    if (items && items.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('items')
        .update({ quantity: 0 })

      if (updateError) {
        console.error('Failed to reset item quantities:', updateError)
        // Don't fail the whole operation if quantity reset fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'All stock data deleted successfully. You can now start fresh with opening stock from December 1st.',
      deleted: {
        opening_stock: true,
        closing_stock: true,
        sales: true,
        restocking: true,
        waste_spoilage: true,
        item_quantities: true,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete stock data'
    console.error('Error deleting stock data:', error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

