import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organization_id')

    let targetOrganizationId: string | null = null
    if (profile.role === 'superadmin') {
      if (!organizationId) {
        return NextResponse.json(
          { error: 'organization_id is required when listing branches as superadmin' },
          { status: 400 }
        )
      }
      targetOrganizationId = organizationId
    } else {
      if (!profile.organization_id) {
        return NextResponse.json(
          { error: 'You must belong to an organization to list branches' },
          { status: 400 }
        )
      }
      targetOrganizationId = profile.organization_id
    }

    // Fetch branches for the organization
    const { data: branches, error } = await supabase
      .from('branches')
      .select('*')
      .eq('organization_id', targetOrganizationId)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json({ branches: branches || [] }, { status: 200 })
  } catch (error) {
    console.error('Error listing branches:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list branches' },
      { status: 500 }
    )
  }
}

