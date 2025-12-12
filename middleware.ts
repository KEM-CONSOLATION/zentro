import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Get subdomain from hostname (backward compatible - returns null if no subdomain)
function getSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0]

  // Allow default flow on Netlify hostnames (no org subdomain enforcement)
  if (host.endsWith('netlify.app')) {
    return null
  }

  // For localhost subdomains (local testing), allow them
  // Example: lacuisine.localhost -> 'lacuisine'
  if (host.endsWith('.localhost')) {
    const subdomain = host.replace('.localhost', '')
    const reserved = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'test', 'staging', 'dev']
    if (reserved.includes(subdomain.toLowerCase())) {
      return null
    }
    return subdomain.toLowerCase()
  }

  // For plain localhost or 127.0.0.1, return null (use default behavior)
  if (host === 'localhost' || host === '127.0.0.1') {
    return null
  }

  // Split by dots
  const parts = host.split('.')

  // If we have at least 3 parts (subdomain.domain.tld), extract subdomain
  // Example: lacuisine.countpadi.com -> ['lacuisine', 'countpadi', 'com']
  if (parts.length >= 3) {
    const subdomain = parts[0]
    // Reserved subdomains that should not be treated as organization subdomains
    const reserved = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'test', 'staging', 'dev']
    if (reserved.includes(subdomain.toLowerCase())) {
      return null
    }
    return subdomain.toLowerCase()
  }

  return null
}

// Rate limiting: Simple in-memory store (for production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

// Clean up old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now()
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetTime < now) {
        rateLimitMap.delete(key)
      }
    }
  },
  5 * 60 * 1000
)

function checkRateLimit(ip: string, limit: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now()
  const key = ip
  const record = rateLimitMap.get(key)

  if (!record || record.resetTime < now) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public SEO files without authentication
  if (
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/sitemap' ||
    (pathname.startsWith('/google') && pathname.endsWith('.html'))
  ) {
    return NextResponse.next()
  }

  // Subdomain detection (backward compatible - only activates if subdomain exists)
  const hostname = request.headers.get('host') || ''
  const subdomain = getSubdomain(hostname)

  // Store organization ID from subdomain for validation
  let orgIdFromSubdomain: string | null = null

  // If subdomain exists, try to find organization and set context
  if (subdomain) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

      if (supabaseUrl && supabaseServiceKey) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })

        const { data: organization } = await supabaseAdmin
          .from('organizations')
          .select('id, name, subdomain')
          .eq('subdomain', subdomain)
          .single()

        if (organization) {
          // Store organization ID for validation
          orgIdFromSubdomain = organization.id

          // Set organization ID in headers for use in pages/components
          const requestHeaders = new Headers(request.headers)
          requestHeaders.set('x-organization-id', organization.id)
          requestHeaders.set('x-organization-subdomain', subdomain)

          // Continue with normal flow but with organization context
          // The rest of the middleware will handle auth as usual
        } else {
          // Subdomain not found - could be invalid or not set up yet
          // Continue with normal flow (don't block - backward compatible)
        }
      }
    } catch (error) {
      // If subdomain lookup fails, continue with normal flow (backward compatible)
      console.error('Error looking up subdomain:', error)
    }
  }

  // Rate limiting for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const isWriteOperation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)

    // Stricter limits for write operations
    const limit = isWriteOperation ? 30 : 100 // 30 writes/min, 100 reads/min
    const allowed = checkRateLimit(ip, limit, 60000) // 1 minute window

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }
  }

  // Request size limit check (for API routes)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const contentLength = request.headers.get('content-length')
    if (contentLength) {
      const size = parseInt(contentLength, 10)
      const maxSize = 1024 * 1024 // 1MB limit
      if (size > maxSize) {
        return NextResponse.json(
          { error: 'Request body too large. Maximum size is 1MB.' },
          { status: 413 }
        )
      }
    }
  }
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    // Check for refresh token errors
    if (error) {
      // Check if it's a refresh token error
      if (
        error.code === 'refresh_token_not_found' ||
        error.message?.includes('refresh_token_not_found') ||
        error.message?.includes('Invalid Refresh Token') ||
        (error.status === 400 && error.message?.includes('Refresh Token'))
      ) {
        // Clear auth cookies and redirect to login
        const response = NextResponse.redirect(new URL('/login?error=session_expired', request.url))

        // Clear all Supabase auth cookies
        const cookieNames = ['sb-access-token', 'sb-refresh-token', 'sb-auth-token']

        cookieNames.forEach(cookieName => {
          response.cookies.delete(cookieName)
          response.cookies.delete(`${cookieName}-expires`)
        })

        // Also clear cookies with the project ref
        const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]
        if (projectRef) {
          cookieNames.forEach(cookieName => {
            response.cookies.delete(`${projectRef}-auth-token`)
            response.cookies.delete(`${projectRef}-auth-token-code-verifier`)
          })
        }

        return response
      }
    }

    // Get organization ID from subdomain (if any)
    const orgIdFromSubdomain = request.headers.get('x-organization-id')

    if (request.nextUrl.pathname.startsWith('/dashboard')) {
      if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
      }

      // SECURITY: If accessing via subdomain, validate user belongs to that organization
      // This works for both localhost subdomains (lacuisine.localhost) and production (lacuisine.countpadi.com)
      if (orgIdFromSubdomain) {
        try {
          // Use service role key to bypass RLS for validation
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

          if (supabaseUrl && supabaseServiceKey) {
            const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
              auth: {
                autoRefreshToken: false,
                persistSession: false,
              },
            })

            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('organization_id, role')
              .eq('id', user.id)
              .single()

            if (profile) {
              // Block superadmin from accessing subdomain
              if (profile.role === 'superadmin') {
                return NextResponse.redirect(
                  new URL('/login?error=superadmin_subdomain', request.url)
                )
              }

              // Validate user belongs to the organization
              if (profile.organization_id !== orgIdFromSubdomain) {
                return NextResponse.redirect(
                  new URL('/login?error=wrong_organization', request.url)
                )
              }
            }
          }
        } catch (error) {
          console.error('Error validating subdomain access:', error)
          return NextResponse.redirect(new URL('/login?error=validation_failed', request.url))
        }
      }
    }

    if (request.nextUrl.pathname.startsWith('/admin')) {
      if (!user) {
        return NextResponse.redirect(new URL('/login', request.url))
      }

      // SECURITY: Block subdomain access to admin pages
      if (orgIdFromSubdomain) {
        return NextResponse.redirect(new URL('/login?error=admin_subdomain', request.url))
      }
    }

    if (request.nextUrl.pathname === '/login' && user) {
      // If user is logged in and accessing via subdomain, validate they belong to it
      if (orgIdFromSubdomain) {
        try {
          // Use service role key to bypass RLS for validation
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

          if (supabaseUrl && supabaseServiceKey) {
            const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
              auth: {
                autoRefreshToken: false,
                persistSession: false,
              },
            })

            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('organization_id, role')
              .eq('id', user.id)
              .single()

            if (profile) {
              // Block superadmin
              if (profile.role === 'superadmin') {
                // Sign out using the regular supabase client
                await supabase.auth.signOut()
                return NextResponse.redirect(
                  new URL('/login?error=superadmin_subdomain', request.url)
                )
              }

              // Validate organization match
              if (profile.organization_id !== orgIdFromSubdomain) {
                // Sign out using the regular supabase client
                await supabase.auth.signOut()
                return NextResponse.redirect(
                  new URL('/login?error=wrong_organization', request.url)
                )
              }
            }
          }
        } catch (error) {
          console.error('Error validating subdomain access:', error)
        }
      }

      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return supabaseResponse
  } catch (error: any) {
    // Handle any unexpected errors, especially refresh token errors
    if (
      error?.code === 'refresh_token_not_found' ||
      error?.message?.includes('refresh_token_not_found') ||
      error?.message?.includes('Invalid Refresh Token') ||
      (error?.status === 400 && error?.message?.includes('Refresh Token'))
    ) {
      const response = NextResponse.redirect(new URL('/login?error=session_expired', request.url))

      // Clear auth cookies
      const cookieNames = ['sb-access-token', 'sb-refresh-token', 'sb-auth-token']

      cookieNames.forEach(cookieName => {
        response.cookies.delete(cookieName)
        response.cookies.delete(`${cookieName}-expires`)
      })

      return response
    }

    // For other errors, continue with normal flow
    return supabaseResponse
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt (robots file)
     * - sitemap.xml (sitemap file)
     * - google*.html (Google verification files)
     * - files with image extensions (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots\\.txt|sitemap\\.xml|google[^/]*\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
