'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import Link from 'next/link'

export default function DashboardStatsCards() {
  const [stats, setStats] = useState({
    openingStockCount: 0,
    closingStockCount: 0,
    todaySales: 0,
    todaySalesCount: 0,
    todaySalesAmount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    fetchStats()
  }, [startDate, endDate])

  const fetchStats = async () => {
    setLoading(true)
    try {
      // Get user's organization_id for filtering
      const { data: { user } } = await supabase.auth.getUser()
      let organizationId: string | null = null
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single()
        organizationId = profile?.organization_id || null
      }

      // Validate date range
      if (startDate > endDate) {
        setEndDate(startDate)
        return
      }

      const today = format(new Date(), 'yyyy-MM-dd')
      if (startDate > today || endDate > today) {
        setStartDate(today)
        setEndDate(today)
        return
      }

      // Fetch opening stock count for date range
      let openingQuery = supabase
        .from('opening_stock')
        .select('id')
        .gte('date', startDate)
        .lte('date', endDate)
      if (organizationId) openingQuery = openingQuery.eq('organization_id', organizationId)
      const { data: openingData } = await openingQuery

      let closingQuery = supabase
        .from('closing_stock')
        .select('id')
        .gte('date', startDate)
        .lte('date', endDate)
      if (organizationId) closingQuery = closingQuery.eq('organization_id', organizationId)
      const { data: closingData } = await closingQuery

      let salesQuery = supabase
        .from('sales')
        .select('total_price')
        .gte('date', startDate)
        .lte('date', endDate)
      if (organizationId) salesQuery = salesQuery.eq('organization_id', organizationId)
      const { data: salesData } = await salesQuery

      const salesAmount = salesData?.reduce((sum, sale) => sum + (sale.total_price || 0), 0) || 0

      setStats({
        openingStockCount: openingData?.length || 0,
        closingStockCount: closingData?.length || 0,
        todaySales: salesData?.length || 0,
        todaySalesCount: salesData?.length || 0,
        todaySalesAmount: salesAmount,
      })
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 animate-pulse">
            <div className="h-12 bg-gray-200 rounded mb-4"></div>
            <div className="h-6 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    )
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  const isToday = startDate === today && endDate === today
  const getDateRangeLabel = () => {
    if (startDate === endDate) {
      return format(new Date(startDate), 'MMM dd, yyyy')
    }
    return `${format(new Date(startDate), 'MMM dd')} - ${format(new Date(endDate), 'MMM dd, yyyy')}`
  }
  const dateLabel = isToday ? 'today' : getDateRangeLabel()
  const sectionTitle = isToday 
    ? 'Inventory & Sales Overview' 
    : `Inventory & Sales Overview - ${getDateRangeLabel()}`

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">{sectionTitle}</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="inventory-start-date" className="text-sm text-gray-600 whitespace-nowrap">
            Date Range:
          </label>
          <input
            type="date"
            id="inventory-start-date"
            value={startDate}
            max={format(new Date(), 'yyyy-MM-dd')}
            onChange={(e) => {
              const newStartDate = e.target.value
              const today = format(new Date(), 'yyyy-MM-dd')
              if (newStartDate > today) {
                alert('Cannot select future dates.')
                setStartDate(today)
              } else if (newStartDate > endDate) {
                setEndDate(newStartDate)
                setStartDate(newStartDate)
              } else {
                setStartDate(newStartDate)
              }
            }}
            className="px-3 py-1.5 text-gray-900 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            id="inventory-end-date"
            value={endDate}
            max={format(new Date(), 'yyyy-MM-dd')}
            min={startDate}
            onChange={(e) => {
              const newEndDate = e.target.value
              const today = format(new Date(), 'yyyy-MM-dd')
              if (newEndDate > today) {
                alert('Cannot select future dates.')
                setEndDate(today)
              } else if (newEndDate < startDate) {
                alert('End date cannot be before start date.')
                setEndDate(startDate)
              } else {
                setEndDate(newEndDate)
              }
            }}
            className="px-3 py-1.5 text-gray-900 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => {
              const today = format(new Date(), 'yyyy-MM-dd')
              setStartDate(today)
              setEndDate(today)
            }}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-1"
            title="Reset to Today"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Today
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Opening Stock Card */}
      <Link
        href="/dashboard/opening-stock"
        className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Opening Stock</h2>
        <p className="text-3xl font-bold text-indigo-600 mb-2">{stats.openingStockCount}</p>
        <p className="text-gray-600 text-sm">Items recorded {dateLabel}</p>
      </Link>

      <Link
        href="/dashboard/closing-stock"
        className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Closing Stock</h2>
        <p className="text-3xl font-bold text-green-600 mb-2">{stats.closingStockCount}</p>
        <p className="text-gray-600 text-sm">Items recorded {dateLabel}</p>
      </Link>

      <Link
        href="/dashboard/sales"
        className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">{isToday ? "Today's" : "Sales for"} Sales</h2>
        <p className="text-3xl font-bold text-blue-600 mb-1">₦{stats.todaySalesAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <p className="text-gray-600 text-sm">{stats.todaySalesCount} transaction{stats.todaySalesCount !== 1 ? 's' : ''} {!isToday && `(${getDateRangeLabel()})`}</p>
      </Link>
      </div>
    </div>
  )
}

