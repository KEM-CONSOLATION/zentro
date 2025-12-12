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
    const { date, items, user_id } = body

    if (!date || !items || !Array.isArray(items) || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get user's organization_id
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id, branch_id, role')
      .eq('id', user_id)
      .single()

    const organizationId = profile?.organization_id || null

    // Determine branch_id:
    // 1. Use profile.branch_id if user has one (for branch managers/staff)
    // 2. For admins without branch_id: get organization's main branch
    // 3. Only use null if organization has no branches (new onboarding)
    let branchId: string | null = null
    if (profile?.branch_id) {
      branchId = profile.branch_id
    } else if (profile?.role === 'admin' && !profile?.branch_id && organizationId) {
      // Admin with no branch_id - try to get organization's main branch
      const { data: mainBranch } = await supabaseAdmin
        .from('branches')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      branchId = mainBranch?.id || null
      // If no branches exist yet (new onboarding), branch_id will be null
      // This is acceptable for new businesses that haven't created branches yet
    }

    // Reject future dates
    const today = new Date().toISOString().split('T')[0]
    if (date > today) {
      return NextResponse.json(
        { error: 'Cannot record opening stock for future dates' },
        { status: 400 }
      )
    }

    // Validate items array
    const openingStockRecords = items.map(
      (item: {
        item_id: string
        quantity: number
        cost_price?: number | null
        selling_price?: number | null
      }) => ({
        item_id: item.item_id,
        quantity: item.quantity,
        cost_price: item.cost_price ?? null,
        selling_price: item.selling_price ?? null,
        date,
        recorded_by: user_id,
        organization_id: organizationId,
        branch_id: branchId,
        notes: 'Manually entered opening stock',
      })
    )

    // The unique constraint is (item_id, date, organization_id) - not including branch_id
    // So we need to check for existing records and update/insert accordingly
    for (const record of openingStockRecords) {
      // Check if opening stock already exists for this item/date/org combination
      const { data: existingRecord } = await supabaseAdmin
        .from('opening_stock')
        .select('id')
        .eq('item_id', record.item_id)
        .eq('date', date)
        .eq('organization_id', organizationId || '')
        .maybeSingle()

      if (existingRecord) {
        // Update existing record
        const { error: updateError } = await supabaseAdmin
          .from('opening_stock')
          .update({
            quantity: record.quantity,
            cost_price: record.cost_price,
            selling_price: record.selling_price,
            branch_id: branchId,
            notes: record.notes,
            recorded_by: user_id,
          })
          .eq('id', existingRecord.id)

        if (updateError) {
          return NextResponse.json(
            {
              error: `Failed to update opening stock for item ${record.item_id}: ${updateError.message}`,
            },
            { status: 500 }
          )
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabaseAdmin.from('opening_stock').insert(record)

        if (insertError) {
          return NextResponse.json(
            {
              error: `Failed to insert opening stock for item ${record.item_id}: ${insertError.message}`,
            },
            { status: 500 }
          )
        }
      }
    }

    for (const record of openingStockRecords) {
      if (record.cost_price !== null && record.cost_price !== undefined) {
        const { error: itemUpdateError } = await supabaseAdmin
          .from('items')
          .update({ cost_price: record.cost_price })
          .eq('id', record.item_id)

        if (itemUpdateError) {
          console.error(`Failed to update cost_price for item ${record.item_id}:`, itemUpdateError)
        }
      }

      if (record.selling_price !== null && record.selling_price !== undefined) {
        const { error: itemUpdateError } = await supabaseAdmin
          .from('items')
          .update({ selling_price: record.selling_price })
          .eq('id', record.item_id)

        if (itemUpdateError) {
          console.error(
            `Failed to update selling_price for item ${record.item_id}:`,
            itemUpdateError
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Opening stock saved for ${date}`,
      records_saved: openingStockRecords.length,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to save opening stock'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
