import { createClient } from '@supabase/supabase-js'
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

    if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // Superadmins can create users for any organization, regular admins need their own org
    if (profile.role !== 'superadmin' && !profile.organization_id) {
      return NextResponse.json(
        { error: 'You must belong to an organization to create users' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { email, password, fullName, role, organization_id, branch_id } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Determine organization_id: superadmin can specify, regular admin uses their own
    let targetOrganizationId: string | null = null
    if (profile.role === 'superadmin') {
      if (!organization_id) {
        return NextResponse.json(
          { error: 'organization_id is required when creating users as superadmin' },
          { status: 400 }
        )
      }
      targetOrganizationId = organization_id
    } else {
      targetOrganizationId = profile.organization_id
    }

    // Validate branch_id based on role
    let targetBranchId: string | null = null
    if (role === 'tenant_admin' || (role === 'admin' && !branch_id)) {
      // Tenant admin: branch_id should be null (can switch branches)
      targetBranchId = null
    } else if (role === 'branch_manager' || role === 'staff') {
      // Branch manager and staff: branch_id is required
      if (!branch_id) {
        return NextResponse.json(
          { error: 'branch_id is required when creating branch managers or staff users' },
          { status: 400 }
        )
      }
      // Verify branch belongs to the organization
      const { data: branch } = await supabase
        .from('branches')
        .select('id, organization_id')
        .eq('id', branch_id)
        .single()

      if (!branch || branch.organization_id !== targetOrganizationId) {
        return NextResponse.json(
          { error: 'Invalid branch_id or branch does not belong to the organization' },
          { status: 400 }
        )
      }
      targetBranchId = branch_id
    } else {
      // For other roles (superadmin), use provided branch_id or null
      targetBranchId = branch_id || null
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Service role key not found' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || '',
        role: role || 'staff',
      },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    if (newUser.user) {
      let profileCreated = false
      let retries = 0
      const maxRetries = 5

      while (!profileCreated && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500))

        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('id, role')
          .eq('id', newUser.user.id)
          .single()

        if (existingProfile) {
          if (existingProfile.role !== role) {
            const { error: updateError } = await supabaseAdmin
              .from('profiles')
              .update({ role: (role as 'admin' | 'staff') || 'staff' })
              .eq('id', newUser.user.id)

            if (updateError) {
              return NextResponse.json(
                { error: `User created but role update failed: ${updateError.message}` },
                { status: 500 }
              )
            }
          }
          profileCreated = true
        } else {
          const { error: insertError } = await supabaseAdmin.from('profiles').insert({
            id: newUser.user.id,
            email: newUser.user.email || email,
            full_name: fullName || null,
            role: (role as 'admin' | 'staff' | 'tenant_admin' | 'branch_manager') || 'staff',
            organization_id: targetOrganizationId,
            branch_id: targetBranchId,
          })

          if (!insertError) {
            profileCreated = true
          } else if (insertError.code === '23505') {
            const { data: conflictProfile } = await supabaseAdmin
              .from('profiles')
              .select('id, role')
              .eq('id', newUser.user.id)
              .single()

            if (conflictProfile) {
              const updateData: any = {}
              if (conflictProfile.role !== role) {
                updateData.role = (role as 'admin' | 'staff') || 'staff'
              }
              if (targetOrganizationId) {
                updateData.organization_id = targetOrganizationId
              }
              if (targetBranchId !== undefined) {
                updateData.branch_id = targetBranchId
              }

              if (Object.keys(updateData).length > 0) {
                const { error: updateError } = await supabaseAdmin
                  .from('profiles')
                  .update(updateData)
                  .eq('id', newUser.user.id)

                if (!updateError) {
                  profileCreated = true
                }
              } else {
                profileCreated = true
              }
            }
          } else {
            return NextResponse.json(
              { error: `User created but profile creation failed: ${insertError.message}` },
              { status: 500 }
            )
          }
        }
        retries++
      }

      if (!profileCreated) {
        return NextResponse.json(
          {
            error:
              'User created but profile could not be verified. Please try refreshing the user list.',
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.user?.id,
        email: newUser.user?.email,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create user'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
