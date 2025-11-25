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
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { email, password, fullName, role } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
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
          const { error: insertError } = await supabaseAdmin
            .from('profiles')
            .insert({
              id: newUser.user.id,
              email: newUser.user.email || email,
              full_name: fullName || null,
              role: (role as 'admin' | 'staff') || 'staff',
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
              if (conflictProfile.role !== role) {
                const { error: updateError } = await supabaseAdmin
                  .from('profiles')
                  .update({ role: (role as 'admin' | 'staff') || 'staff' })
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
          { error: 'User created but profile could not be verified. Please try refreshing the user list.' },
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
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

