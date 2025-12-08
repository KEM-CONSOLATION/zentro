'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Sale, Item, Expense } from '@/types/database'
import { format } from 'date-fns'

export default function ProfitLossView() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [totalSales, setTotalSales] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [netProfit, setNetProfit] = useState(0)
  const [salesDetails, setSalesDetails] = useState<Array<{
    item: Item
    quantity: number
    sellingPrice: number
    costPrice: number
    totalSelling: number
    totalCost: number
    profit: number
  }>>([])

  useEffect(() => {
    calculateProfitLoss()
  }, [selectedDate])

  const calculateProfitLoss = async () => {
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

      // Fetch sales for the date
      let salesQuery = supabase
        .from('sales')
        .select('*, item:items(*)')
        .eq('date', selectedDate)
      
      if (organizationId) {
        salesQuery = salesQuery.eq('organization_id', organizationId)
      }
      
      const { data: sales } = await salesQuery

      if (!sales) return

      // Group sales by item and calculate totals
      const itemMap = new Map<string, {
        item: Item
        quantity: number
        sellingPrice: number
        costPrice: number
        totalSelling: number
        totalCost: number
        profit: number
      }>()

      sales.forEach((sale: Sale & { item?: Item }) => {
        if (!sale.item) return

        const existing = itemMap.get(sale.item_id) || {
          item: sale.item,
          quantity: 0,
          sellingPrice: sale.price_per_unit,
          costPrice: sale.item.cost_price,
          totalSelling: 0,
          totalCost: 0,
          profit: 0,
        }

        existing.quantity += sale.quantity
        existing.totalSelling += sale.total_price
        existing.totalCost += sale.quantity * sale.item.cost_price
        existing.profit = existing.totalSelling - existing.totalCost

        itemMap.set(sale.item_id, existing)
      })

      const details = Array.from(itemMap.values())
      setSalesDetails(details)

      // Calculate totals
      const salesTotal = details.reduce((sum, d) => sum + d.totalSelling, 0)
      const costTotal = details.reduce((sum, d) => sum + d.totalCost, 0)
      const profitTotal = salesTotal - costTotal

      setTotalSales(salesTotal)
      setTotalCost(costTotal)
      setTotalProfit(profitTotal)

      // Fetch expenses
      let expensesQuery = supabase
        .from('expenses')
        .select('amount')
        .eq('date', selectedDate)
      
      if (organizationId) {
        expensesQuery = expensesQuery.eq('organization_id', organizationId)
      }
      
      const { data: expenses } = await expensesQuery

      const expensesTotal = expenses?.reduce((sum: number, exp: { amount: number }) => sum + (exp.amount || 0), 0) || 0
      setTotalExpenses(expensesTotal)
      setNetProfit(profitTotal - expensesTotal)
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Profit & Loss Report</h2>
        <div className="flex items-center gap-4">
          <label htmlFor="profit-date" className="block text-sm font-medium text-gray-700">
            Select Date
          </label>
          <input
            id="profit-date"
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
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-gray-900 cursor-pointer"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-500">Calculating profit/loss...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-600 mb-1">Total Sales</p>
              <p className="text-2xl font-bold text-blue-900">₦{totalSales.toFixed(2)}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600 mb-1">Total Cost</p>
              <p className="text-2xl font-bold text-red-900">₦{totalCost.toFixed(2)}</p>
            </div>
            <div className={`border rounded-lg p-4 ${totalProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
              <p className={`text-sm mb-1 ${totalProfit >= 0 ? 'text-green-600' : 'text-orange-600'}`}>Gross Profit</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-900' : 'text-orange-900'}`}>
                ₦{totalProfit.toFixed(2)}
              </p>
            </div>
            <div className={`border rounded-lg p-4 ${netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
              <p className={`text-sm mb-1 ${netProfit >= 0 ? 'text-green-600' : 'text-orange-600'}`}>Net Profit</p>
              <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-900' : 'text-orange-900'}`}>
                ₦{netProfit.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">(After expenses: ₦{totalExpenses.toFixed(2)})</p>
            </div>
          </div>

          {salesDetails.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Item-wise Profit Breakdown</h3>
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Selling Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Sales</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {salesDetails.map((detail, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {detail.item.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {detail.quantity} {detail.item.unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₦{detail.sellingPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₦{detail.costPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ₦{detail.totalSelling.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₦{detail.totalCost.toFixed(2)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          detail.profit >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ₦{detail.profit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

