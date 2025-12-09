import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Only admins and superadmins can update branches
    if (profile.role !== 'admin' && profile.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, address, phone, is_active } = body

    if (!id) {
      return NextResponse.json({ error: 'Branch ID is required' }, { status: 400 })
    }

    // Verify branch exists and user has access
    const { data: branch, error: fetchError } = await supabase
      .from('branches')
      .select('organization_id')
      .eq('id', id)
      .single()

    if (fetchError || !branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // Superadmins can update any branch, regular admins only their organization's branches
    if (profile.role !== 'superadmin' && branch.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Forbidden: Cannot update branch from another organization' }, { status: 403 })
    }

    // If name is being updated, check for duplicates
    if (name && name !== branch.name) {
      const { data: existing } = await supabase
        .from('branches')
        .select('id')
        .eq('organization_id', branch.organization_id)
        .eq('name', name)
        .neq('id', id)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'Branch name already exists for this organization' },
          { status: 400 }
        )
      }
    }

    // Update branch
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (address !== undefined) updateData.address = address
    if (phone !== undefined) updateData.phone = phone
    if (is_active !== undefined) updateData.is_active = is_active
    updateData.updated_at = new Date().toISOString()

    const { data: updatedBranch, error } = await supabase
      .from('branches')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ branch: updatedBranch }, { status: 200 })
  } catch (error) {
    console.error('Error updating branch:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update branch' },
      { status: 500 }
    )
  }
}

