'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { OpeningStock, ClosingStock, Sale, Item, Profile } from '@/types/database'
import { format } from 'date-fns'
import ItemManagement from './ItemManagement'
import UserManagement from './UserManagement'
import MenuManagement from './MenuManagement'
import RecipeManagement from './RecipeManagement'
import SuperAdminView from './SuperAdminView'

function ResetQuantitiesSection() {
  const [resetting, setResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleResetQuantities = async () => {
    if (!confirm('This will set all item quantities to zero. The system will then only use opening/closing stock for quantities. This cannot be undone. Continue?')) {
      return
    }

    setResetting(true)
    setResetMessage(null)

    try {
      const response = await fetch('/api/items/reset-quantities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset quantities')
      }

      setResetMessage({
        type: 'success',
        text: data.message || `Success! ${data.items_updated} item quantity(ies) reset to zero. The system will now only use opening/closing stock for quantities.`,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset quantities'
      setResetMessage({ type: 'error', text: errorMessage })
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6 border-2 border-orange-200 hidden">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Reset Item Quantities</h3>
      <p className="text-sm text-gray-600 mb-4">
        Set all item quantities to zero. After this, the system will only use opening/closing stock for quantities. 
        If no opening/closing stock exists, the quantity will be zero.
      </p>
      
      {resetMessage && (
        <div
          className={`p-3 rounded mb-4 ${
            resetMessage.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {resetMessage.text}
        </div>
      )}

      <button
        onClick={handleResetQuantities}
        disabled={resetting}
        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {resetting ? 'Resetting...' : 'Reset All Quantities to Zero'}
      </button>
      
      <p className="mt-3 text-xs text-gray-500">
        <strong>Warning:</strong> This action cannot be undone. Make sure you have recorded opening/closing stock 
        for your items before resetting quantities.
      </p>
    </div>
  )
}

function DeleteAllStockDataSection() {
  const [deleting, setDeleting] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleDeleteAllStock = async () => {
    if (!confirm('⚠️ WARNING: This will DELETE ALL stock data including:\n\n- Opening Stock\n- Closing Stock\n- Sales/Usage\n- Restocking\n- Waste/Spoilage\n\nThis action CANNOT be undone. Are you absolutely sure you want to proceed?')) {
      return
    }

    // Double confirmation
    if (!confirm('This is your last chance. Are you 100% sure you want to delete ALL stock data?')) {
      return
    }

    setDeleting(true)
    setDeleteMessage(null)

    try {
      const response = await fetch('/api/stock/delete-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete stock data')
      }

      setDeleteMessage({
        type: 'success',
        text: data.message || 'All stock data deleted successfully. You can now start fresh with opening stock from December 1st.',
      })
      
      // Refresh the page after 2 seconds to show empty state
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete stock data'
      setDeleteMessage({ type: 'error', text: errorMessage })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6 border-2 border-red-200 hidden">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete All Stock Data</h3>
      <p className="text-sm text-gray-600 mb-4">
        <strong className="text-red-600">⚠️ DANGER ZONE:</strong> This will permanently delete ALL stock-related data including opening stock, closing stock, sales, restocking, and waste/spoilage records. 
        This is useful when you want to start completely fresh (e.g., from December 1st).
      </p>
      
      {deleteMessage && (
        <div
          className={`p-3 rounded mb-4 ${
            deleteMessage.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {deleteMessage.text}
        </div>
      )}

      <button
        onClick={handleDeleteAllStock}
        disabled={deleting}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {deleting ? 'Deleting All Data...' : '⚠️ Delete All Stock Data'}
      </button>
      
      <p className="mt-3 text-xs text-red-600 font-semibold">
        <strong>⚠️ WARNING:</strong> This action is IRREVERSIBLE. All stock data will be permanently deleted. 
        Make sure you have a backup if needed.
      </p>
    </div>
  )
}

const formatDateSafely = (dateString: string): string => {
  if (!dateString || !dateString.trim()) return 'N/A'
  try {
    const date = new Date(dateString + 'T00:00:00')
    if (isNaN(date.getTime())) return 'Invalid Date'
    return format(date, 'MMM dd, yyyy')
  } catch {
    return 'Invalid Date'
  }
}

export default function AdminDashboard() {
  const [selectedDate, setSelectedDate] = useState(() => {
    try {
      return format(new Date(), 'yyyy-MM-dd')
    } catch {
      return new Date().toISOString().split('T')[0]
    }
  })
  const [openingStocks, setOpeningStocks] = useState<(OpeningStock & { item: Item; recorded_by_profile: Profile })[]>([])
  const [closingStocks, setClosingStocks] = useState<(ClosingStock & { item: Item; recorded_by_profile: Profile })[]>([])
  const [sales, setSales] = useState<(Sale & { item: Item; recorded_by_profile: Profile })[]>([])
  const [loading, setLoading] = useState(false)
  const [userRole, setUserRole] = useState<'admin' | 'superadmin' | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'users' | 'menu' | 'recipes' | 'superadmin'>('overview')

  useEffect(() => {
    checkUserRole()
    if (userRole !== 'superadmin') {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, userRole])

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile) {
        const role = profile.role as 'admin' | 'superadmin'
        setUserRole(role)
        // Superadmins should default to superadmin tab
        if (role === 'superadmin') {
          setActiveTab('superadmin')
        }
      }
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: openingData } = await supabase
        .from('opening_stock')
        .select('*, item:items(*), recorded_by_profile:profiles(*)')
        .eq('date', selectedDate)
        .order('created_at', { ascending: false })

      if (openingData) {
        setOpeningStocks(openingData as (OpeningStock & { item: Item; recorded_by_profile: Profile })[])
      }

      const { data: closingData } = await supabase
        .from('closing_stock')
        .select('*, item:items(*), recorded_by_profile:profiles(*)')
        .eq('date', selectedDate)
        .order('created_at', { ascending: false })

      if (closingData) {
        setClosingStocks(closingData as (ClosingStock & { item: Item; recorded_by_profile: Profile })[])
      }

      const { data: salesData } = await supabase
        .from('sales')
        .select('*, item:items(*), recorded_by_profile:profiles(*)')
        .eq('date', selectedDate)
        .order('created_at', { ascending: false })

      if (salesData) {
        setSales(salesData as (Sale & { item: Item; recorded_by_profile: Profile })[])
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  // Superadmins only see SuperAdminView - no organization-specific features
  if (userRole === 'superadmin') {
    return <SuperAdminView />
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Management Dashboard</h1>
        <p className="mt-2 text-gray-600">Monitor all inventory activities</p>
      </div>

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto -mx-6 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`${
                activeTab === 'overview'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-pointer transition-colors`}
            >
              Daily Overview
            </button>
            <button
              onClick={() => setActiveTab('items')}
              className={`${
                activeTab === 'items'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-pointer transition-colors`}
            >
              Manage Items
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`${
                activeTab === 'users'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-pointer transition-colors`}
            >
              Manage Users
            </button>
            <button
              onClick={() => setActiveTab('menu')}
              className={`${
                activeTab === 'menu'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-pointer transition-colors`}
            >
              Digital Menu
            </button>
            <button
              onClick={() => setActiveTab('recipes')}
              className={`${
                activeTab === 'recipes'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-pointer transition-colors`}
            >
              Recipes
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <ResetQuantitiesSection />
          <DeleteAllStockDataSection />
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
              Select Date
            </label>
            <input
              id="date"
              type="date"
              value={selectedDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => {
                const selectedDate = e.target.value
                const today = format(new Date(), 'yyyy-MM-dd')
                if (selectedDate > today) {
                  alert('Cannot select future dates. Please select today or a past date.')
                  setSelectedDate(today)
                } else {
                  setSelectedDate(selectedDate)
                }
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-gray-900"
            />
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-gray-500">Loading data...</p>
            </div>
          ) : (
            <>
              {/* Opening Stock Section */}
              <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Opening Stock - {formatDateSafely(selectedDate)}
                  </h2>
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {openingStocks.length} {openingStocks.length === 1 ? 'record' : 'records'}
                  </span>
                </div>
                {openingStocks.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="mt-2 text-gray-500">No opening stock recorded for this date</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-6 px-6">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Recorded By
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {openingStocks.map((stock) => (
                          <tr key={stock.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {stock.item?.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className="font-medium">{stock.quantity}</span> {stock.item?.unit}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {stock.recorded_by_profile?.full_name || stock.recorded_by_profile?.email}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{stock.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Closing Stock Section */}
              <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Closing Stock - {formatDateSafely(selectedDate)}
                  </h2>
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {closingStocks.length} {closingStocks.length === 1 ? 'record' : 'records'}
                  </span>
                </div>
                {closingStocks.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="mt-2 text-gray-500">No closing stock recorded for this date</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-6 px-6">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Recorded By
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {closingStocks.map((stock) => (
                          <tr key={stock.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {stock.item?.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className="font-medium">{stock.quantity}</span> {stock.item?.unit}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {stock.recorded_by_profile?.full_name || stock.recorded_by_profile?.email}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{stock.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Sales Section */}
              <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Sales/Usage - {formatDateSafely(selectedDate)}
                  </h2>
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {sales.length} {sales.length === 1 ? 'record' : 'records'}
                  </span>
                </div>
                {sales.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <p className="mt-2 text-gray-500">No sales recorded for this date</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-6 px-6">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity Used
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Recorded By
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sales.map((sale) => (
                          <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {sale.item?.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className="font-medium">{sale.quantity}</span> {sale.item?.unit}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{sale.description || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {sale.recorded_by_profile?.full_name || sale.recorded_by_profile?.email}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'items' && <ItemManagement />}
      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'menu' && <MenuManagement />}
      {activeTab === 'recipes' && <RecipeManagement />}
    </div>
  )
}

