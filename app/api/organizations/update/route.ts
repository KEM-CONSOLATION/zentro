import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { organization_id, name, logo_url, brand_color } = body

    if (!organization_id || !name) {
      return NextResponse.json({ error: 'organization_id and name are required' }, { status: 400 })
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

    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')

    const updateData: any = { 
      name, 
      slug, 
      updated_at: new Date().toISOString() 
    }
    
    if (logo_url !== undefined) {
      updateData.logo_url = logo_url || null
    }
    
    if (brand_color !== undefined) {
      updateData.brand_color = brand_color || null
    }

    const { data: organization, error } = await supabaseAdmin
      .from('organizations')
      .update(updateData)
      .eq('id', organization_id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Organization slug already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, organization })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update organization'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

