'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Sale, Item } from '@/types/database'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#4f46e5', '#7c3aed', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff', '#f3e8ff']

export default function TopItemsChart() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [topItems, setTopItems] = useState<{ name: string; quantity: number; sales: number }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [period])

  const fetchData = async () => {
    setLoading(true)
    try {
      if (period === 'daily') {
        await fetchDailyData()
      } else if (period === 'weekly') {
        await fetchWeeklyData()
      } else {
        await fetchMonthlyData()
      }
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  const fetchDailyData = async () => {
    const today = format(new Date(), 'yyyy-MM-dd')

    const { data: salesData } = await supabase
      .from('sales')
      .select('*, item:items(*)')
      .eq('date', today)

    if (!salesData) return

    const itemMap = new Map<string, { name: string; quantity: number; sales: number }>()

    salesData.forEach((sale: Sale & { item?: Item }) => {
      if (!sale.item) return
      const itemId = sale.item_id
      const itemName = sale.item.name

      if (!itemMap.has(itemId)) {
        itemMap.set(itemId, {
          name: itemName,
          quantity: 0,
          sales: 0,
        })
      }

      const itemData = itemMap.get(itemId)!
      itemData.quantity += sale.quantity
      itemData.sales += sale.total_price || 0
    })

    const items = Array.from(itemMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 7)

    setTopItems(items)
  }

  const fetchWeeklyData = async () => {
    const weekStart = startOfWeek(new Date())
    const weekEnd = endOfWeek(new Date())
    const startDate = format(weekStart, 'yyyy-MM-dd')
    const endDate = format(weekEnd, 'yyyy-MM-dd')

    const { data: salesData } = await supabase
      .from('sales')
      .select('*, item:items(*)')
      .gte('date', startDate)
      .lte('date', endDate)

    if (!salesData) return

    const itemMap = new Map<string, { name: string; quantity: number; sales: number }>()

    salesData.forEach((sale: Sale & { item?: Item }) => {
      if (!sale.item) return
      const itemId = sale.item_id
      const itemName = sale.item.name

      if (!itemMap.has(itemId)) {
        itemMap.set(itemId, {
          name: itemName,
          quantity: 0,
          sales: 0,
        })
      }

      const itemData = itemMap.get(itemId)!
      itemData.quantity += sale.quantity
      itemData.sales += sale.total_price || 0
    })

    const items = Array.from(itemMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 7)

    setTopItems(items)
  }

  const fetchMonthlyData = async () => {
    const monthStart = startOfMonth(new Date())
    const monthEnd = endOfMonth(new Date())
    const startDate = format(monthStart, 'yyyy-MM-dd')
    const endDate = format(monthEnd, 'yyyy-MM-dd')

    const { data: salesData } = await supabase
      .from('sales')
      .select('*, item:items(*)')
      .gte('date', startDate)
      .lte('date', endDate)

    if (!salesData) return

    const itemMap = new Map<string, { name: string; quantity: number; sales: number }>()

    salesData.forEach((sale: Sale & { item?: Item }) => {
      if (!sale.item) return
      const itemId = sale.item_id
      const itemName = sale.item.name

      if (!itemMap.has(itemId)) {
        itemMap.set(itemId, {
          name: itemName,
          quantity: 0,
          sales: 0,
        })
      }

      const itemData = itemMap.get(itemId)!
      itemData.quantity += sale.quantity
      itemData.sales += sale.total_price || 0
    })

    const items = Array.from(itemMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 7)

    setTopItems(items)
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Top Selling Items</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('daily')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              period === 'daily'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setPeriod('weekly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              period === 'weekly'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              period === 'monthly'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            This Month
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : topItems.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-500">
          No sales data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topItems} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis 
              type="category" 
              dataKey="name" 
              tick={{ fontSize: 12, fontWeight: 'bold', textRendering: 'geometricPrecision' }}
              width={120}
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                if (name === 'quantity') return [value, 'Quantity']
                return [`₦${value.toFixed(2)}`, 'Sales']
              }}
              contentStyle={{ backgroundColor: '#fff', color: '#000', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
            <Legend />
            <Bar dataKey="quantity" name="Quantity Sold" fill="#4f46e5" radius={[0, 4, 4, 0]}>
              {topItems.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

