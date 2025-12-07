import { createClient } from '@supabase/supabase-js'
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

    if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    // Prevent self-deletion
    if (userId === user.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    // Get target user's profile
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', userId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Regular admins can only delete staff in their organization
    if (profile.role === 'admin') {
      if (!profile.organization_id || targetProfile.organization_id !== profile.organization_id) {
        return NextResponse.json({ error: 'You can only delete staff in your organization' }, { status: 403 })
      }

      // Admins cannot delete other admins
      if (targetProfile.role === 'admin') {
        return NextResponse.json({ error: 'You cannot delete other admins' }, { status: 403 })
      }

      // Admins cannot delete superadmins
      if (targetProfile.role === 'superadmin') {
        return NextResponse.json({ error: 'You cannot delete superadmins' }, { status: 403 })
      }
    }

    // Superadmins can delete anyone except other superadmins
    if (profile.role === 'superadmin' && targetProfile.role === 'superadmin') {
      return NextResponse.json({ error: 'Superadmins cannot delete other superadmins' }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Service role key not found' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Delete user from auth.users (this will cascade delete profile)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Error deleting user from auth:', {
        error: deleteError,
        message: deleteError.message,
        status: deleteError.status,
        userId
      })
      
      // Provide more specific error messages
      let errorMessage = deleteError.message || 'Database error deleting user'
      
      // Check for common error patterns
      if (deleteError.message?.includes('foreign key') || 
          deleteError.message?.includes('constraint') ||
          deleteError.message?.includes('violates foreign key') ||
          deleteError.message?.includes('still referenced')) {
        errorMessage = 'Cannot delete user: User has associated records (sales, stock, expenses). The database needs to be updated to allow deletion. Please contact support.'
      } else if (deleteError.message?.includes('permission') || deleteError.message?.includes('unauthorized')) {
        errorMessage = 'Permission denied: Unable to delete user. Please check your permissions.'
      } else if (deleteError.message?.includes('not found')) {
        errorMessage = 'User not found or already deleted.'
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? deleteError.message : undefined
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    })
  } catch (error) {
    console.error('Error in delete user route:', error)
    const errorMessage = error instanceof Error ? error.message : 'Database error deleting user'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

