'use client'

import { useState, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'
import { getAppName, getDefaultBrandColor } from '@/components/OrganizationLogo'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  const errorParam = searchParams.get('error')
  useEffect(() => {
    if (errorParam === 'unauthorized' && !error) {
      setError('Your account is not authorized. Please contact an administrator.')
    } else if (errorParam === 'session_expired' && !error) {
      setError('Your session has expired. Please sign in again.')
    } else if (errorParam === 'inactivity' && !error) {
      setError('You were logged out due to inactivity. Please sign in again.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorParam])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      await new Promise(resolve => setTimeout(resolve, 500))

      let profile = null
      let retries = 0
      const maxRetries = 3

      while (!profile && retries < maxRetries) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single()

        if (profileData) {
          profile = profileData
          break
        }

        await new Promise(resolve => setTimeout(resolve, 500))
        retries++
      }

      if (!profile) {
        await supabase.auth.signOut()
        setError('Profile not found. Please contact an administrator.')
        setLoading(false)
        return
      }

      // Check for saved return path
      const returnPath = localStorage.getItem('returnPath')
      localStorage.removeItem('returnPath') // Clear it after use

      await new Promise(resolve => setTimeout(resolve, 500))

      // Redirect to saved path or default to dashboard
      const redirectPath =
        returnPath && (returnPath.startsWith('/dashboard') || returnPath.startsWith('/admin'))
          ? returnPath
          : '/dashboard'

      window.location.replace(redirectPath)
    } catch (error) {
      let errorMessage = 'An error occurred'

      if (error instanceof Error) {
        errorMessage = error.message

        // Provide more helpful error messages
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorMessage =
            'Unable to connect to the server. Please check your internet connection and try again. If the problem persists, the Supabase service may be temporarily unavailable.'
        } else if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please try again.'
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please confirm your email address before signing in.'
        } else if (error.message.includes('Supabase is not configured')) {
          errorMessage = 'Application configuration error. Please contact support.'
        }
      }

      setError(errorMessage)
      setLoading(false)
    }
  }

  const appName = getAppName()
  const brandColor = getDefaultBrandColor()

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 space-y-6">
        <div className="flex flex-col items-center justify-center">
          <Image
            src="/CountPadi.jpeg"
            alt={appName}
            width={120}
              height={120}
            className="object-contain"
            priority
          />
        </div>

        <div className=" space-y-6">
          <p className="text-center  text-gray-600">Sign in to your account</p>
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-2 px-4 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              style={
                {
                  backgroundColor: brandColor,
                  '--tw-ring-color': brandColor,
                } as React.CSSProperties & { '--tw-ring-color': string }
              }
              onMouseEnter={e => {
                const color = brandColor
                const r = parseInt(color.slice(1, 3), 16)
                const g = parseInt(color.slice(3, 5), 16)
                const b = parseInt(color.slice(5, 7), 16)
                const darker = `rgb(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)})`
                e.currentTarget.style.backgroundColor = darker
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = brandColor
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
            <div className="flex flex-col items-center">
              <Image
                src="/CountPadi.jpeg"
                alt={getAppName()}
                width={120}
                height={120}
                className="object-contain"
                priority
              />
              {/* <h1
                className="text-3xl font-bold text-center"
                style={{ color: getDefaultBrandColor() }}
              >
                {getAppName()}
              </h1> */}
            </div>
            <p className="text-center text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
