'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { format, subDays } from 'date-fns'
import Link from 'next/link'

export default function ExpenseStatsCards() {
  const [previousDaySales, setPreviousDaySales] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const previousDate = format(subDays(new Date(today), 1), 'yyyy-MM-dd')

    try {
      // Fetch previous day sales
      const { data: sales } = await supabase
        .from('sales')
        .select('total_price')
        .eq('date', previousDate)

      const salesTotal = sales?.reduce((sum, sale) => sum + (sale.total_price || 0), 0) || 0
      setPreviousDaySales(salesTotal)

      // Fetch today's expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('date', today)

      const expensesTotal = (expenses || []).reduce((sum, exp) => sum + (exp.amount || 0), 0)
      setTotalExpenses(expensesTotal)

      // Calculate balance
      setBalance(salesTotal - expensesTotal)
    } catch (error) {
      console.error('Error fetching expense stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Previous Day Sales Card */}
      <Link
        href="/dashboard/expenses"
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
        <p className="text-sm text-blue-600 mb-1">Previous Day Sales</p>
        <p className="text-2xl font-bold text-blue-900">₦{previousDaySales.toFixed(2)}</p>
      </Link>

      {/* Total Expenses Today Card */}
      <Link
        href="/dashboard/expenses"
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
        <p className="text-sm text-red-600 mb-1">Total Expenses Today</p>
        <p className="text-2xl font-bold text-red-900">₦{totalExpenses.toFixed(2)}</p>
      </Link>

      {/* Balance After Expenses Card */}
      <Link
        href="/dashboard/expenses"
        className={`border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer group ${
          balance >= 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
            balance >= 0 
              ? 'bg-green-100 group-hover:bg-green-200' 
              : 'bg-orange-100 group-hover:bg-orange-200'
          }`}>
            <svg className={`w-6 h-6 ${balance >= 0 ? 'text-green-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-colors ${
            balance >= 0 ? 'group-hover:text-green-600' : 'group-hover:text-orange-600'
          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <p className={`text-sm mb-1 ${balance >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
          Balance After Expenses
        </p>
        <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-900' : 'text-orange-900'}`}>
          ₦{balance.toFixed(2)}
        </p>
      </Link>
    </div>
  )
}

