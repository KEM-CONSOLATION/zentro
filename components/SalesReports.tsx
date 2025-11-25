'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Sale, Item, Profile } from '@/types/database'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns'

interface SalesSummary {
  date: string
  total_sales: number
  total_items: number
  sales_count: number
}

export default function SalesReports() {
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dailySales, setDailySales] = useState<SalesSummary | null>(null)
  const [weeklySales, setWeeklySales] = useState<SalesSummary | null>(null)
  const [monthlySales, setMonthlySales] = useState<SalesSummary | null>(null)
  const [salesDetails, setSalesDetails] = useState<(Sale & { item?: Item; recorded_by_profile?: Profile })[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchReports()
  }, [selectedPeriod, selectedDate])

  const fetchReports = async () => {
    setLoading(true)
    try {
      if (selectedPeriod === 'daily') {
        await fetchDailySales()
      } else if (selectedPeriod === 'weekly') {
        await fetchWeeklySales()
      } else {
        await fetchMonthlySales()
      }
    } catch (error) {
      // Error fetching reports
    } finally {
      setLoading(false)
    }
  }

  const fetchDailySales = async () => {
    const { data: salesData } = await supabase
      .from('sales')
      .select('*, item:items(*), recorded_by_profile:profiles(*)')
      .eq('date', selectedDate)
      .order('created_at', { ascending: false })

    if (salesData) {
      const sales = salesData as (Sale & { item?: Item; recorded_by_profile?: Profile })[]
      setSalesDetails(sales)
      const total = sales.reduce((sum, sale) => sum + (sale.total_price || 0), 0)
      const uniqueItems = new Set(sales.map(s => s.item_id)).size
      setDailySales({
        date: selectedDate,
        total_sales: total,
        total_items: uniqueItems,
        sales_count: sales.length,
      })
    }
  }

  const fetchWeeklySales = async () => {
    const weekStart = startOfWeek(new Date(selectedDate), { weekStartsOn: 1 })
    const weekEnd = endOfWeek(new Date(selectedDate), { weekStartsOn: 1 })
    
    const { data: salesData } = await supabase
      .from('sales')
      .select('*, item:items(*), recorded_by_profile:profiles(*)')
      .gte('date', format(weekStart, 'yyyy-MM-dd'))
      .lte('date', format(weekEnd, 'yyyy-MM-dd'))
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (salesData) {
      const sales = salesData as (Sale & { item?: Item; recorded_by_profile?: Profile })[]
      setSalesDetails(sales)
      const total = sales.reduce((sum, sale) => sum + (sale.total_price || 0), 0)
      const uniqueItems = new Set(sales.map(s => s.item_id)).size
      setWeeklySales({
        date: `${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd, yyyy')}`,
        total_sales: total,
        total_items: uniqueItems,
        sales_count: sales.length,
      })
    }
  }

  const fetchMonthlySales = async () => {
    const monthStart = startOfMonth(new Date(selectedDate))
    const monthEnd = endOfMonth(new Date(selectedDate))
    
    const { data: salesData } = await supabase
      .from('sales')
      .select('*, item:items(*), recorded_by_profile:profiles(*)')
      .gte('date', format(monthStart, 'yyyy-MM-dd'))
      .lte('date', format(monthEnd, 'yyyy-MM-dd'))
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (salesData) {
      const sales = salesData as (Sale & { item?: Item; recorded_by_profile?: Profile })[]
      setSalesDetails(sales)
      const total = sales.reduce((sum, sale) => sum + (sale.total_price || 0), 0)
      const uniqueItems = new Set(sales.map(s => s.item_id)).size
      setMonthlySales({
        date: format(monthStart, 'MMMM yyyy'),
        total_sales: total,
        total_items: uniqueItems,
        sales_count: sales.length,
      })
    }
  }

  const currentReport = selectedPeriod === 'daily' ? dailySales : selectedPeriod === 'weekly' ? weeklySales : monthlySales

  return (
    <div>
      <div className="mb-6 bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex space-x-4">
            <button
              onClick={() => setSelectedPeriod('daily')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                selectedPeriod === 'daily'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setSelectedPeriod('weekly')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                selectedPeriod === 'weekly'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setSelectedPeriod('monthly')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                selectedPeriod === 'monthly'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Monthly
            </button>
          </div>
          <div>
            <label htmlFor="report-date" className="block text-sm font-medium text-gray-700 mb-1">
              {selectedPeriod === 'daily' ? 'Select Date' : selectedPeriod === 'weekly' ? 'Select Week' : 'Select Month'}
            </label>
            <input
              id="report-date"
              type={selectedPeriod === 'monthly' ? 'month' : 'date'}
              value={selectedPeriod === 'monthly' ? selectedDate.substring(0, 7) : selectedDate}
              onChange={(e) => {
                if (selectedPeriod === 'monthly') {
                  setSelectedDate(e.target.value + '-01')
                } else {
                  setSelectedDate(e.target.value)
                }
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-gray-900 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-500">Loading report...</p>
        </div>
      ) : currentReport ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-500 mb-1">Total Sales</p>
              <p className="text-3xl font-bold text-indigo-600">₦{currentReport.total_sales.toFixed(2)}</p>
            </div>
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-500 mb-1">Total Transactions</p>
              <p className="text-3xl font-bold text-gray-900">{currentReport.sales_count}</p>
            </div>
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <p className="text-sm text-gray-500 mb-1">Items Sold</p>
              <p className="text-3xl font-bold text-gray-900">{currentReport.total_items}</p>
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {selectedPeriod === 'daily' ? 'Daily' : selectedPeriod === 'weekly' ? 'Weekly' : 'Monthly'} Sales Details
            </h2>
            {salesDetails.length === 0 ? (
              <p className="text-gray-500">No sales records found for this period</p>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price/Unit</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {salesDetails.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {format(new Date(sale.date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {sale.item?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {sale.quantity} {sale.item?.unit || ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₦{sale.price_per_unit.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ₦{sale.total_price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{sale.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500">Select a period to view sales reports</p>
        </div>
      )}
    </div>
  )
}

