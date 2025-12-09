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

    // Only admins and superadmins can assign users to branches
    if (profile.role !== 'admin' && profile.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { user_id, branch_id } = body

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // If branch_id is provided, verify it exists and belongs to the organization
    if (branch_id) {
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id, organization_id')
        .eq('id', branch_id)
        .single()

      if (branchError || !branch) {
        return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
      }

      // Superadmins can assign to any branch, regular admins only their organization's branches
      if (profile.role !== 'superadmin' && branch.organization_id !== profile.organization_id) {
        return NextResponse.json(
          { error: 'Forbidden: Cannot assign user to branch from another organization' },
          { status: 403 }
        )
      }
    }

    // Get the target user's profile
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select('id, organization_id, role')
      .eq('id', user_id)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Superadmins can assign any user, regular admins only users in their organization
    if (profile.role !== 'superadmin' && targetUser.organization_id !== profile.organization_id) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot assign user from another organization' },
        { status: 403 }
      )
    }

    // Update user's branch_id
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({ branch_id: branch_id || null })
      .eq('id', user_id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ user: updatedProfile }, { status: 200 })
  } catch (error) {
    console.error('Error assigning user to branch:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to assign user to branch' },
      { status: 500 }
    )
  }
}

