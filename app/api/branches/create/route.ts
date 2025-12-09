import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
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

    // Only admins and superadmins can create branches
    if (profile.role !== 'admin' && profile.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // Superadmins need to specify organization_id, regular admins use their own
    const body = await request.json()
    const { name, address, phone, organization_id } = body

    if (!name) {
      return NextResponse.json({ error: 'Branch name is required' }, { status: 400 })
    }

    let targetOrganizationId: string | null = null
    if (profile.role === 'superadmin') {
      if (!organization_id) {
        return NextResponse.json(
          { error: 'organization_id is required when creating branches as superadmin' },
          { status: 400 }
        )
      }
      targetOrganizationId = organization_id
    } else {
      if (!profile.organization_id) {
        return NextResponse.json(
          { error: 'You must belong to an organization to create branches' },
          { status: 400 }
        )
      }
      targetOrganizationId = profile.organization_id
    }

    // Check if branch name already exists for this organization
    const { data: existing } = await supabase
      .from('branches')
      .select('id')
      .eq('organization_id', targetOrganizationId)
      .eq('name', name)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Branch name already exists for this organization' },
        { status: 400 }
      )
    }

    // Create branch
    const { data: branch, error } = await supabase
      .from('branches')
      .insert({
        organization_id: targetOrganizationId,
        name,
        address: address || null,
        phone: phone || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ branch }, { status: 201 })
  } catch (error) {
    console.error('Error creating branch:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create branch' },
      { status: 500 }
    )
  }
}

