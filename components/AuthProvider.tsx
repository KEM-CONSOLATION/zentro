'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 minutes in milliseconds
const WARNING_TIME = 30 * 1000 // Show warning 30 seconds before logout

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(0)
  const [showWarning, setShowWarning] = useState(false)

  const handleLogout = useCallback(async (reason: 'inactivity' | 'session_expired' | 'error' = 'session_expired') => {
    try {
      const currentPath = window.location.pathname
      
      // Clear all auth-related cookies
      document.cookie.split(';').forEach((c) => {
        const cookieName = c.trim().split('=')[0]
        if (cookieName.includes('supabase') || cookieName.includes('auth')) {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`
        }
      })

      // Sign out from Supabase
      await supabase.auth.signOut()

      // Redirect to login with appropriate error message
      if (currentPath.startsWith('/dashboard') || currentPath.startsWith('/admin')) {
        const errorParam = reason === 'inactivity' ? 'inactivity' : 'session_expired'
        router.push(`/login?error=${errorParam}`)
        router.refresh()
      }
    } catch (error) {
      console.error('Error during logout:', error)
      // Force redirect even if logout fails
      router.push('/login?error=session_expired')
      router.refresh()
    }
  }, [router])

  const handleInactivityLogout = useCallback(async () => {
    // Save current path before logout
    const currentPath = window.location.pathname
    if (currentPath && (currentPath.startsWith('/dashboard') || currentPath.startsWith('/admin'))) {
      localStorage.setItem('returnPath', currentPath)
    }
    
    await handleLogout('inactivity')
  }, [handleLogout])

  const resetInactivityTimer = useCallback(() => {
    // Clear existing timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current)
    }
    
    // Hide warning when user becomes active
    setShowWarning(false)

    // Check if user is authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Only track inactivity on protected routes
        const currentPath = window.location.pathname
        if (currentPath?.startsWith('/dashboard') || currentPath?.startsWith('/admin')) {
          lastActivityRef.current = Date.now()
          
          // Set warning timer (30 seconds before logout)
          warningTimerRef.current = setTimeout(() => {
            setShowWarning(true)
          }, INACTIVITY_TIMEOUT - WARNING_TIME)
          
          // Set logout timer
          inactivityTimerRef.current = setTimeout(() => {
            handleInactivityLogout()
          }, INACTIVITY_TIMEOUT)
        }
      }
    })
  }, [handleInactivityLogout])

  useEffect(() => {
    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle token refresh errors
      if (event === 'TOKEN_REFRESHED' && !session) {
        // Token refresh failed, log out user
        await handleLogout()
      }

      // Handle signed out event
      if (event === 'SIGNED_OUT') {
        // Clear any local storage or state if needed
        if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin')) {
          router.push('/login?error=session_expired')
          router.refresh()
        }
      }

      // Reset inactivity timer on auth state change
      if (event === 'SIGNED_IN' && session) {
        resetInactivityTimer()
      }
    })


    // Listen for unhandled promise rejections (catches auth errors)
    const handleUnhandledRejection = async (event: PromiseRejectionEvent) => {
      const error = event.reason
      if (
        error?.code === 'refresh_token_not_found' ||
        error?.message?.includes('refresh_token_not_found') ||
        error?.message?.includes('Invalid Refresh Token') ||
        (error?.status === 400 && error?.message?.includes('Refresh Token'))
      ) {
        event.preventDefault() // Prevent default error logging
        console.error('Unhandled refresh token error, logging out user:', error)
        await handleLogout()
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    // Periodically check auth status
    const checkAuthStatus = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          // Check if it's a refresh token error
          if (
            error.code === 'refresh_token_not_found' ||
            error.message?.includes('refresh_token_not_found') ||
            error.message?.includes('Invalid Refresh Token')
          ) {
            await handleLogout()
            return
          }
        }

        // If no session and on protected route, redirect to login
        if (!session && (pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin'))) {
          router.push('/login?error=session_expired')
          router.refresh()
        }
      } catch (error: unknown) {
        // Handle any errors during session check
        const err = error as { code?: string; message?: string }
        if (
          err?.code === 'refresh_token_not_found' ||
          err?.message?.includes('refresh_token_not_found') ||
          err?.message?.includes('Invalid Refresh Token')
        ) {
          await handleLogout()
        }
      }
    }

    // Check auth status every 30 seconds
    const authCheckInterval = setInterval(checkAuthStatus, 30000)

    // Set up inactivity tracking
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']

    // Add event listeners for user activity
    activityEvents.forEach((event) => {
      document.addEventListener(event, resetInactivityTimer, true)
    })

    // Initialize inactivity timer after a brief delay to avoid setState in effect
    const initTimer = setTimeout(() => {
      resetInactivityTimer()
    }, 0)

    // Also check on visibility change (when user switches tabs/windows)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetInactivityTimer()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      clearInterval(authCheckInterval)
      
      // Remove activity event listeners
      activityEvents.forEach((event) => {
        document.removeEventListener(event, resetInactivityTimer, true)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      
      // Clear inactivity timers
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current)
      }
      clearTimeout(initTimer)
    }
  }, [router, pathname, handleLogout, handleInactivityLogout, resetInactivityTimer])

  return (
    <>
      {showWarning && (
        <div className="fixed top-4 right-4 z-50 bg-yellow-500 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-4 animate-pulse">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-semibold">Session Timeout Warning</p>
            <p className="text-sm">You will be logged out in 30 seconds due to inactivity.</p>
          </div>
          <button
            onClick={() => {
              resetInactivityTimer()
              setShowWarning(false)
            }}
            className="ml-4 px-4 py-2 bg-white text-yellow-600 rounded font-medium hover:bg-yellow-50 transition-colors cursor-pointer"
          >
            Stay Logged In
          </button>
        </div>
      )}
      {children}
    </>
  )
}

