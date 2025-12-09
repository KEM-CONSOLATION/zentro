import Cookies from 'js-cookie'

/**
 * Cookie utility functions for managing application state
 * Uses js-cookie for reliable cookie handling
 */

const COOKIE_OPTIONS = {
  expires: 365, // 1 year
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
}

// Cookie keys
export const COOKIE_KEYS = {
  SELECTED_BRANCH: 'selected_branch_id',
  USER_PREFERENCES: 'user_preferences',
  FEATURE_FLAGS: 'feature_flags',
  LAST_ORGANIZATION: 'last_organization_id',
  TOUR_COMPLETED: 'tour_completed',
} as const

/**
 * Get a cookie value
 */
export function getCookie(key: string): string | undefined {
  return Cookies.get(key)
}

/**
 * Set a cookie value
 */
export function setCookie(key: string, value: string, options?: Cookies.CookieAttributes): void {
  Cookies.set(key, value, { ...COOKIE_OPTIONS, ...options })
}

/**
 * Remove a cookie
 */
export function removeCookie(key: string): void {
  Cookies.remove(key)
}

/**
 * Get selected branch ID from cookie
 */
export function getSelectedBranchId(): string | null {
  const branchId = getCookie(COOKIE_KEYS.SELECTED_BRANCH)
  return branchId || null
}

/**
 * Set selected branch ID in cookie
 */
export function setSelectedBranchId(branchId: string): void {
  setCookie(COOKIE_KEYS.SELECTED_BRANCH, branchId)
}

/**
 * Clear selected branch ID
 */
export function clearSelectedBranchId(): void {
  removeCookie(COOKIE_KEYS.SELECTED_BRANCH)
}

/**
 * Get last organization ID from cookie
 */
export function getLastOrganizationId(): string | null {
  const orgId = getCookie(COOKIE_KEYS.LAST_ORGANIZATION)
  return orgId || null
}

/**
 * Set last organization ID in cookie
 */
export function setLastOrganizationId(organizationId: string): void {
  setCookie(COOKIE_KEYS.LAST_ORGANIZATION, organizationId)
}

/**
 * Get user preferences from cookie
 */
export function getUserPreferences(): Record<string, unknown> | null {
  const prefs = getCookie(COOKIE_KEYS.USER_PREFERENCES)
  if (!prefs) return null
  try {
    return JSON.parse(prefs) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Set user preferences in cookie
 */
export function setUserPreferences(preferences: Record<string, unknown>): void {
  setCookie(COOKIE_KEYS.USER_PREFERENCES, JSON.stringify(preferences))
}

/**
 * Get feature flags from cookie
 */
export function getFeatureFlags(): Record<string, boolean> | null {
  const flags = getCookie(COOKIE_KEYS.FEATURE_FLAGS)
  if (!flags) return null
  try {
    return JSON.parse(flags) as Record<string, boolean>
  } catch {
    return null
  }
}

/**
 * Set feature flags in cookie
 */
export function setFeatureFlags(flags: Record<string, boolean>): void {
  setCookie(COOKIE_KEYS.FEATURE_FLAGS, JSON.stringify(flags))
}

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flagName: string): boolean {
  const flags = getFeatureFlags()
  return flags?.[flagName] === true
}

/**
 * Tour helpers
 */
export function hasCompletedTour(): boolean {
  return getCookie(COOKIE_KEYS.TOUR_COMPLETED) === 'true'
}

export function markTourCompleted(): void {
  setCookie(COOKIE_KEYS.TOUR_COMPLETED, 'true')
}

export function clearTourCompleted(): void {
  removeCookie(COOKIE_KEYS.TOUR_COMPLETED)
}

/**
 * Clear all application cookies
 */
export function clearAllCookies(): void {
  Object.values(COOKIE_KEYS).forEach(key => {
    removeCookie(key)
  })
}
