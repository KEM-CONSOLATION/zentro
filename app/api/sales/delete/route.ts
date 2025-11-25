import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { searchParams } = new URL(request.url)
    const sale_id = searchParams.get('sale_id')
    const item_id = searchParams.get('item_id')
    const quantity = searchParams.get('quantity')

    if (!sale_id || !item_id || !quantity) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Delete sale record (DO NOT restore item quantity - opening stock stays constant)
    const { error: deleteError } = await supabaseAdmin
      .from('sales')
      .delete()
      .eq('id', sale_id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete sales'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

