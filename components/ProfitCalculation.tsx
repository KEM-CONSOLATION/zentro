'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Sale, Item } from '@/types/database'
import { format } from 'date-fns'

export default function ProfitCalculation() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [sales, setSales] = useState<(Sale & { item?: Item })[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchSales()
  }, [selectedDate])

  const fetchSales = async () => {
    setLoading(true)
    try {
      const { data: salesData } = await supabase
        .from('sales')
        .select('*, item:items(*)')
        .eq('date', selectedDate)
        .order('created_at', { ascending: false })

      if (salesData) {
        setSales(salesData as (Sale & { item?: Item })[])
      }
    } catch (error) {
      console.error('Error fetching sales:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateTotals = () => {
    let totalSellingPrice = 0
    let totalCostPrice = 0

    sales.forEach((sale) => {
      if (sale.item) {
        const sellingPrice = sale.total_price || 0
        const costPrice = (sale.item.cost_price || 0) * sale.quantity
        totalSellingPrice += sellingPrice
        totalCostPrice += costPrice
      }
    })

    const profit = totalSellingPrice - totalCostPrice
    const profitMargin = totalSellingPrice > 0 ? (profit / totalSellingPrice) * 100 : 0

    return {
      totalSellingPrice,
      totalCostPrice,
      profit,
      profitMargin,
    }
  }

  const totals = calculateTotals()

  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
      <div className="mb-6">
        <label htmlFor="profit-date" className="block text-sm font-medium text-gray-700 mb-2">
          Select Date
        </label>
        <input
          id="profit-date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-gray-900 cursor-pointer"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
              <p className="text-sm text-indigo-600 mb-1">Total Selling Price</p>
              <p className="text-2xl font-bold text-indigo-900">₦{totals.totalSellingPrice.toFixed(2)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <p className="text-sm text-red-600 mb-1">Total Cost Price</p>
              <p className="text-2xl font-bold text-red-900">₦{totals.totalCostPrice.toFixed(2)}</p>
            </div>
            <div className={`rounded-lg p-4 border ${totals.profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-sm mb-1 ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Profit</p>
              <p className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                ₦{totals.profit.toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Profit Margin</p>
              <p className="text-2xl font-bold text-gray-900">{totals.profitMargin.toFixed(1)}%</p>
            </div>
          </div>

          {sales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Selling Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sales.map((sale) => {
                    const costPrice = (sale.item?.cost_price || 0) * sale.quantity
                    const sellingPrice = sale.total_price || 0
                    const profit = sellingPrice - costPrice
                    return (
                      <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {sale.item?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {sale.quantity} {sale.item?.unit || ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₦{sellingPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₦{costPrice.toFixed(2)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ₦{profit.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No sales recorded for this date</p>
          )}
        </>
      )}
    </div>
  )
}

