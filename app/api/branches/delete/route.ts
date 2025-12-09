import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest) {
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

    // Only admins and superadmins can delete branches
    if (profile.role !== 'admin' && profile.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branch_id')

    if (!branchId) {
      return NextResponse.json({ error: 'branch_id is required' }, { status: 400 })
    }

    // Verify branch exists and user has access
    const { data: branch, error: fetchError } = await supabase
      .from('branches')
      .select('organization_id, name')
      .eq('id', branchId)
      .single()

    if (fetchError || !branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    }

    // Superadmins can delete any branch, regular admins only their organization's branches
    if (profile.role !== 'superadmin' && branch.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Forbidden: Cannot delete branch from another organization' }, { status: 403 })
    }

    // Check if branch has associated data (users, sales, etc.)
    const { count: userCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId)

    const { count: salesCount } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId)

    if ((userCount || 0) > 0 || (salesCount || 0) > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete branch with associated users or sales. Please reassign or remove all data first.',
        },
        { status: 400 }
      )
    }

    // Delete branch (CASCADE will handle related data)
    const { error } = await supabase.from('branches').delete().eq('id', branchId)

    if (error) throw error

    return NextResponse.json({ message: 'Branch deleted successfully' }, { status: 200 })
  } catch (error) {
    console.error('Error deleting branch:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete branch' },
      { status: 500 }
    )
  }
}

