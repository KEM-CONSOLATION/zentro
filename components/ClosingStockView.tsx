'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Item, Sale } from '@/types/database'
import { format } from 'date-fns'

export default function ClosingStockView() {
  const [items, setItems] = useState<Item[]>([])
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [calculatedStocks, setCalculatedStocks] = useState<Array<{
    item: Item
    openingStock: number
    totalSales: number
    closingStock: number
  }>>([])

  useEffect(() => {
    fetchItems()
  }, [])

  useEffect(() => {
    if (items.length > 0) {
      calculateClosingStocks()
    }
  }, [selectedDate, items])

  const fetchItems = async () => {
    const { data, error } = await supabase.from('items').select('*').order('name')
    if (error) {
      // Error fetching items
    } else {
      setItems(data || [])
    }
  }

  const calculateClosingStocks = async () => {
    setLoading(true)
    try {
      // Get opening stock for the selected date
      const { data: openingStocks } = await supabase
        .from('opening_stock')
        .select('item_id, quantity')
        .eq('date', selectedDate)

      const openingMap = new Map(openingStocks?.map(o => [o.item_id, o.quantity]) || [])

      // Get total sales for the selected date
      const { data: sales } = await supabase
        .from('sales')
        .select('item_id, quantity')
        .eq('date', selectedDate)

      const salesMap = new Map<string, number>()
      sales?.forEach(sale => {
        const current = salesMap.get(sale.item_id) || 0
        salesMap.set(sale.item_id, current + sale.quantity)
      })

      // Calculate closing stock for each item
      const stocks = items.map(item => {
        const openingQty = openingMap.get(item.id) || item.quantity
        const totalSalesQty = salesMap.get(item.id) || 0
        const closingQty = openingQty - totalSalesQty

        return {
          item,
          openingStock: openingQty,
          totalSales: totalSalesQty,
          closingStock: Math.max(0, closingQty), // Don't show negative
        }
      })

      setCalculatedStocks(stocks)
    } catch (error) {
      // Error calculating stocks
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Closing Stock Report</h2>
        <div className="flex items-center gap-4">
          <label htmlFor="date" className="block text-sm font-medium text-gray-700">
            Select Date
          </label>
          <input
            id="date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-gray-900 cursor-pointer"
          />
          <p className="text-sm text-gray-500">
            Closing stock = Opening stock - Total sales for the day
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-500">Calculating closing stocks...</p>
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
                  Opening Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Sales
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Closing Stock
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {calculatedStocks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    No items found
                  </td>
                </tr>
              ) : (
                calculatedStocks.map((stock) => (
                  <tr key={stock.item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {stock.item.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-medium">{stock.openingStock}</span> {stock.item.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="font-medium">{stock.totalSales}</span> {stock.item.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-medium">{stock.closingStock}</span> {stock.item.unit}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

