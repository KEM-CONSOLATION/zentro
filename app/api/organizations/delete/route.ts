import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const organization_id = searchParams.get('organization_id')

    if (!organization_id) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 })
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

    // Check if organization has any users
    const { count: userCount } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)

    if (userCount && userCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete organization with existing users. Please reassign or delete users first.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', organization_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Organization deleted successfully' })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete organization'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

