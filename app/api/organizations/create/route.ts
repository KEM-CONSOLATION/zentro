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
    const { name, user_id } = body

    if (!name || !user_id) {
      return NextResponse.json({ error: 'Missing name or user_id' }, { status: 400 })
    }

    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')

    const { data: organization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name,
        slug,
        created_by: user_id,
      })
      .select()
      .single()

    if (orgError) {
      return NextResponse.json({ error: orgError.message }, { status: 500 })
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ organization_id: organization.id })
      .eq('id', user_id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Auto-create "Main Branch" for the new organization
    const { data: mainBranch, error: branchError } = await supabaseAdmin
      .from('branches')
      .insert({
        organization_id: organization.id,
        name: organization.name + ' - Main Branch',
        is_active: true,
      })
      .select()
      .single()

    if (branchError) {
      console.error('Error creating main branch:', branchError)
      // Don't fail the organization creation if branch creation fails
      // The branch can be created manually later
    }

    return NextResponse.json({ success: true, organization, branch: mainBranch || null })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create organization'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
