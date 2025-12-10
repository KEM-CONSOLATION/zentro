'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { Profile, Organization } from '@/types/database'
import OrganizationLogo, {
  getOrganizationBrandColor,
  getAppName,
  getDefaultBrandColor,
} from './OrganizationLogo'
import NotificationCenter from './NotificationCenter'
import BranchSelector from './BranchSelector'
import UserTour from './UserTour'
import { hasCompletedTour, clearAllCookies } from '@/lib/utils/cookies'
import { useAuthStore } from '@/lib/stores/authStore'
import { useBranchStore } from '@/lib/stores/branchStore'
import { useOrganizationStore } from '@/lib/stores/organizationStore'
import { useItemsStore } from '@/lib/stores/itemsStore'
import { useSalesStore } from '@/lib/stores/salesStore'
import { useStockStore } from '@/lib/stores/stockStore'

interface DashboardLayoutProps {
  children: React.ReactNode
  user: Profile
}

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loadingOrg, setLoadingOrg] = useState(true)
  const [runTour, setRunTour] = useState(false)

  const tourTargets: Record<string, string> = useMemo(() => {
    return {
      '/dashboard': 'nav-dashboard',
      '/dashboard/opening-stock': 'nav-opening',
      '/dashboard/restocking': 'nav-restocking',
      '/dashboard/closing-stock': 'nav-closing',
      '/dashboard/sales': 'nav-sales',
      '/dashboard/history': 'nav-history',
      '/dashboard/reports': 'nav-reports',
      '/dashboard/profit-loss': 'nav-profit-loss',
      '/dashboard/expenses': 'nav-expenses',
      '/dashboard/waste-spoilage': 'nav-waste',
      '/dashboard/inventory-valuation': 'nav-valuation',
      '/dashboard/transfers': 'nav-transfers',
      '/dashboard/branches': 'nav-branches',
      '/admin': user.role === 'superadmin' ? 'nav-organizations' : 'nav-users',
    }
  }, [user.role])

  useEffect(() => {
    if (user.organization_id && user.role !== 'superadmin') {
      fetchOrganization()
    } else {
      setLoadingOrg(false)
    }
  }, [user.organization_id, user.role])

  useEffect(() => {
    if (!hasCompletedTour()) {
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setSidebarOpen(true)
      }
      setRunTour(true)
    }
  }, [])

  const fetchOrganization = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', user.organization_id)
        .single()

      if (error) throw error
      setOrganization(data)
    } catch (error) {
      console.error('Error fetching organization:', error)
    } finally {
      setLoadingOrg(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('returnPath')
    useAuthStore.getState().clear()
    useBranchStore.getState().clear()
    useOrganizationStore.getState().clear()
    useItemsStore.getState().clear()
    useSalesStore.getState().clear()
    useStockStore.getState().clear()
    clearAllCookies()
    router.push('/login')
    router.refresh()
    supabase.auth.signOut().catch(() => {})
  }

  const isActive = (path: string) => pathname === path

  const brandColor =
    user.role === 'superadmin' ? getDefaultBrandColor() : getOrganizationBrandColor(organization)

  const appName = user.role === 'superadmin' ? getAppName() : organization?.name || getAppName()

  const allNavItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
      roles: ['staff', 'controller', 'branch_manager', 'admin', 'tenant_admin'],
    },
    {
      name: 'Opening Stock',
      href: '/dashboard/opening-stock',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
      ),
      roles: ['branch_manager', 'admin', 'tenant_admin'], // Staff and controller don't need this
    },
    {
      name: 'Restocking',
      href: '/dashboard/restocking',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      roles: ['branch_manager', 'admin', 'tenant_admin'], // Staff and controller cannot access
    },
    {
      name: 'Closing Stock',
      href: '/dashboard/closing-stock',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      roles: ['branch_manager', 'admin', 'tenant_admin'], // Staff and controller don't need this
    },
    {
      name: 'Sales/Usage',
      href: '/dashboard/sales',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
      ),
      roles: ['branch_manager', 'admin', 'tenant_admin'], // Staff and controller use issuance workflow
    },
    {
      name: 'Issue Items',
      href: '/dashboard/issuances',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      roles: ['controller', 'branch_manager', 'admin', 'tenant_admin'],
    },
    {
      name: 'Returns',
      href: '/dashboard/returns',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      ),
      roles: ['controller', 'branch_manager', 'admin', 'tenant_admin'],
    },
    {
      name: 'Reconciliation',
      href: '/dashboard/reconciliation',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
      roles: ['controller', 'branch_manager', 'admin', 'tenant_admin'],
    },
    {
      name: 'Staff Performance',
      href: '/dashboard/staff-performance',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      roles: ['controller', 'branch_manager', 'admin', 'tenant_admin'],
    },
    {
      name: 'My Issuances',
      href: '/dashboard/my-issuances',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
      roles: ['staff'],
    },
    {
      name: 'History',
      href: '/dashboard/history',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      roles: ['controller', 'branch_manager', 'admin', 'tenant_admin'], // Staff don't need history
    },
    {
      name: 'Sales Reports',
      href: '/dashboard/reports',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
      roles: ['controller', 'branch_manager', 'admin', 'tenant_admin'], // Staff don't need sales reports
    },
    {
      name: 'Profit & Loss',
      href: '/dashboard/profit-loss',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      ),
      roles: ['branch_manager', 'admin', 'tenant_admin'], // Staff cannot access - financial data is management-only
    },
    {
      name: 'Transfers',
      href: '/dashboard/transfers',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9l-3 3m0 0l3 3m-3-3h18M16 15l3-3m0 0l-3-3m3 3H4"
          />
        </svg>
      ),
      roles: ['branch_manager', 'admin', 'tenant_admin'], // Staff and controller cannot access
    },
    {
      name: 'Expenses',
      href: '/dashboard/expenses',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      roles: ['controller', 'branch_manager', 'admin', 'tenant_admin'], // Staff don't need expenses
    },
    {
      name: 'Waste/Spoilage',
      href: '/dashboard/waste-spoilage',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      ),
      roles: ['controller', 'branch_manager', 'admin', 'tenant_admin'], // Staff don't need waste/spoilage
    },
    {
      name: 'Inventory Valuation',
      href: '/dashboard/inventory-valuation',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      ),
      roles: ['branch_manager', 'admin', 'tenant_admin'], // Staff and controller don't need this
    },
    {
      name: 'Branches',
      href: '/dashboard/branches',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      ),
      roles: ['admin', 'tenant_admin'], // Only tenant admins can manage branches
    },
    {
      name: 'Management',
      href: '/admin',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
      roles: ['admin', 'tenant_admin', 'branch_manager'], // Admins, tenant admins, and branch managers can access management
    },
  ]

  // Filter navigation based on user role
  const navigation =
    user.role === 'superadmin'
      ? [
          {
            name: 'Organizations',
            href: '/admin',
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            ),
          },
        ]
      : allNavItems.filter(item => {
          const userRole = user.role as string
          if (userRole === 'admin' || userRole === 'tenant_admin') {
            return item.roles.includes('admin') || item.roles.includes('tenant_admin')
          }
          return item.roles.includes(userRole)
        })

  return (
    <div className="min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              {loadingOrg ? (
                <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
              ) : (
                <OrganizationLogo organization={organization} size="md" />
              )}
              <h1
                className="text-xl font-bold"
                style={{ color: brandColor }}
                data-tour="dashboard-header"
              >
                {loadingOrg ? '...' : appName}
              </h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto" data-tour="sidebar">
            {navigation.map(item => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                    active
                      ? 'text-white border-l-4'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  style={
                    active
                      ? {
                          backgroundColor: brandColor,
                          borderLeftColor: brandColor,
                        }
                      : {}
                  }
                  data-tour={tourTargets[item.href]}
                >
                  <span className={`mr-3 ${active ? 'text-white' : 'text-gray-400'}`}>
                    {item.icon}
                  </span>
                  {item.name}
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center mb-3">
              <div className="shrink-0">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                  style={{ backgroundColor: brandColor }}
                >
                  {(user.full_name || user.email).charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.full_name || user.email}
                </p>
                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Logout"
              className="w-full flex items-center justify-center px-4 py-3 sm:py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors min-h-[44px] touch-manipulation"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="lg:pl-64">
        <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-2 sm:px-4 lg:px-8 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700 cursor-pointer flex-shrink-0"
              data-tour="sidebar-toggle"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <div className="flex-1 min-w-0" />
            <div
              className="flex items-center gap-1 sm:gap-2 lg:gap-3 min-w-0 flex-shrink-0"
              data-tour="topbar-actions"
            >
              {user.role !== 'superadmin' && (
                <>
                  <div className="min-w-0 flex-shrink">
                    <BranchSelector />
                  </div>
                  <div className="relative flex-shrink-0">
                    <NotificationCenter />
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  // On mobile, open sidebar if tour targets sidebar items
                  if (window.innerWidth < 768) {
                    setSidebarOpen(true)
                  }
                  setRunTour(true)
                }}
                className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors touch-manipulation cursor-pointer flex-shrink-0 min-h-[44px]"
                title="Run quick tour"
                data-tour="tour-trigger"
                aria-label="Take tour"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M12 14a4 4 0 10-4-4"
                  />
                </svg>
                <span className="hidden md:inline">Take tour</span>
              </button>
              <div className="hidden lg:block">
                <h2 className="text-lg font-semibold text-gray-900">
                  {user.role === 'superadmin'
                    ? 'Super Admin'
                    : pathname === '/dashboard'
                      ? 'Dashboard'
                      : pathname === '/dashboard/opening-stock'
                        ? 'Opening Stock'
                        : pathname === '/dashboard/restocking'
                          ? 'Restocking'
                          : pathname === '/dashboard/closing-stock'
                            ? 'Closing Stock'
                            : pathname === '/dashboard/sales'
                              ? 'Sales/Usage'
                              : pathname === '/dashboard/history'
                                ? 'History'
                                : pathname === '/dashboard/reports'
                                  ? 'Sales Reports'
                                  : pathname === '/dashboard/profit-loss'
                                    ? 'Profit & Loss'
                                    : pathname === '/dashboard/expenses'
                                      ? 'Expenses'
                                      : pathname === '/dashboard/waste-spoilage'
                                        ? 'Waste/Spoilage'
                                        : pathname === '/dashboard/inventory-valuation'
                                          ? 'Inventory Valuation'
                                          : pathname === '/admin'
                                            ? 'Management'
                                            : ''}
                </h2>
              </div>
            </div>
          </div>
        </div>

        <main className="py-6 px-4 sm:px-6 lg:px-8">
          <UserTour user={user} run={runTour} onClose={() => setRunTour(false)} />
          {children}
        </main>
      </div>
    </div>
  )
}
