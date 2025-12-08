'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Sale, Item } from '@/types/database'
import { format } from 'date-fns'
import Link from 'next/link'

export default function ProfitLossStatsCards() {
  const [totalSales, setTotalSales] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [netProfit, setNetProfit] = useState(0)
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

      // Fetch sales for date range
      let salesQuery = supabase
        .from('sales')
        .select('*, item:items(*)')
        .gte('date', startDate)
        .lte('date', endDate)
      
      if (organizationId) {
        salesQuery = salesQuery.eq('organization_id', organizationId)
      }
      
      const { data: sales } = await salesQuery

      if (!sales) {
        setLoading(false)
        return
      }

      // Group sales by item and calculate totals
      const itemMap = new Map<string, {
        totalSelling: number
        totalCost: number
      }>()

      sales.forEach((sale: Sale & { item?: Item }) => {
        if (!sale.item) return

        const existing = itemMap.get(sale.item_id) || {
          totalSelling: 0,
          totalCost: 0,
        }

        existing.totalSelling += sale.total_price
        existing.totalCost += sale.quantity * sale.item.cost_price

        itemMap.set(sale.item_id, existing)
      })

      const details = Array.from(itemMap.values())

      // Calculate totals
      const salesTotal = details.reduce((sum, d) => sum + d.totalSelling, 0)
      const costTotal = details.reduce((sum, d) => sum + d.totalCost, 0)
      const profitTotal = salesTotal - costTotal

      setTotalSales(salesTotal)
      setTotalCost(costTotal)
      setTotalProfit(profitTotal)

      // Fetch expenses for date range
      let expensesQuery = supabase
        .from('expenses')
        .select('amount')
        .gte('date', startDate)
        .lte('date', endDate)
      
      if (organizationId) {
        expensesQuery = expensesQuery.eq('organization_id', organizationId)
      }
      
      const { data: expenses } = await expensesQuery

      const expensesTotal = expenses?.reduce((sum: number, exp: { amount: number }) => sum + (exp.amount || 0), 0) || 0
      setTotalExpenses(expensesTotal)
      setNetProfit(profitTotal - expensesTotal)
    } catch (error) {
      console.error('Error fetching profit/loss stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
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
  const sectionTitle = isToday 
    ? "Today's Profit & Loss" 
    : `Profit & Loss - ${getDateRangeLabel()}`

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">{sectionTitle}</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="profit-start-date" className="text-sm text-gray-600 whitespace-nowrap">
            Date Range:
          </label>
          <input
            type="date"
            id="profit-start-date"
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
            id="profit-end-date"
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Sales Card */}
      <Link
        href="/dashboard/profit-loss"
        className="bg-blue-50 border border-blue-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <p className="text-sm text-blue-600 mb-1">Total Sales</p>
        <p className="text-2xl font-bold text-blue-900">₦{totalSales.toFixed(2)}</p>
      </Link>

      {/* Total Cost Card */}
      <Link
        href="/dashboard/profit-loss"
        className="bg-red-50 border border-red-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <p className="text-sm text-red-600 mb-1">Total Cost</p>
        <p className="text-2xl font-bold text-red-900">₦{totalCost.toFixed(2)}</p>
      </Link>

      {/* Gross Profit Card */}
      <Link
        href="/dashboard/profit-loss"
        className={`border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer group ${
          totalProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
            totalProfit >= 0 
              ? 'bg-green-100 group-hover:bg-green-200' 
              : 'bg-orange-100 group-hover:bg-orange-200'
          }`}>
            <svg className={`w-6 h-6 ${totalProfit >= 0 ? 'text-green-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-colors ${
            totalProfit >= 0 ? 'group-hover:text-green-600' : 'group-hover:text-orange-600'
          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <p className={`text-sm mb-1 ${totalProfit >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
          Gross Profit
        </p>
        <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-900' : 'text-orange-900'}`}>
          ₦{totalProfit.toFixed(2)}
        </p>
      </Link>

      {/* Net Profit Card */}
      <Link
        href="/dashboard/profit-loss"
        className={`border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer group ${
          netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
            netProfit >= 0 
              ? 'bg-green-100 group-hover:bg-green-200' 
              : 'bg-orange-100 group-hover:bg-orange-200'
          }`}>
            <svg className={`w-6 h-6 ${netProfit >= 0 ? 'text-green-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-colors ${
            netProfit >= 0 ? 'group-hover:text-green-600' : 'group-hover:text-orange-600'
          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <p className={`text-sm mb-1 ${netProfit >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
          Net Profit
        </p>
        <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-900' : 'text-orange-900'}`}>
          ₦{netProfit.toFixed(2)}
        </p>
        <p className="text-xs text-gray-500 mt-1">(After expenses: ₦{totalExpenses.toFixed(2)})</p>
      </Link>
      </div>
    </div>
  )
}

