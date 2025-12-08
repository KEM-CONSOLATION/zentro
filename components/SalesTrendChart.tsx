'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Sale, Item } from '@/types/database'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function SalesTrendChart() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [dailyData, setDailyData] = useState<{ day: string; sales: number }[]>([])
  const [weeklyData, setWeeklyData] = useState<{ week: string; sales: number }[]>([])
  const [monthlyData, setMonthlyData] = useState<{ month: string; sales: number }[]>([])
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
    const days: { day: string; sales: number }[] = []
    
    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayLabel = format(date, 'EEE, MMM dd')

      const { data: salesData } = await supabase
        .from('sales')
        .select('total_price')
        .eq('date', dateStr)

      const totalSales = salesData?.reduce((sum, sale) => sum + (sale.total_price || 0), 0) || 0
      
      days.push({
        day: dayLabel,
        sales: totalSales,
      })
    }

    setDailyData(days)
  }

  const fetchWeeklyData = async () => {
    const weeks = eachWeekOfInterval({
      start: subWeeks(new Date(), 7),
      end: new Date(),
    })

    const weeklySales: { week: string; sales: number }[] = []

    for (const weekStart of weeks) {
      const weekEnd = endOfWeek(weekStart)
      const startDate = format(weekStart, 'yyyy-MM-dd')
      const endDate = format(weekEnd, 'yyyy-MM-dd')

      const { data: salesData } = await supabase
        .from('sales')
        .select('total_price')
        .gte('date', startDate)
        .lte('date', endDate)

      const totalSales = salesData?.reduce((sum, sale) => sum + (sale.total_price || 0), 0) || 0
      
      weeklySales.push({
        week: format(weekStart, 'MMM dd'),
        sales: totalSales,
      })
    }

    setWeeklyData(weeklySales)
  }

  const fetchMonthlyData = async () => {
    const months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date(),
    })

    const monthlySales: { month: string; sales: number }[] = []

    for (const monthStart of months) {
      const monthEnd = endOfMonth(monthStart)
      const startDate = format(monthStart, 'yyyy-MM-dd')
      const endDate = format(monthEnd, 'yyyy-MM-dd')

      const { data: salesData } = await supabase
        .from('sales')
        .select('total_price')
        .gte('date', startDate)
        .lte('date', endDate)

      const totalSales = salesData?.reduce((sum, sale) => sum + (sale.total_price || 0), 0) || 0
      
      monthlySales.push({
        month: format(monthStart, 'MMM yyyy'),
        sales: totalSales,
      })
    }

    setMonthlyData(monthlySales)
  }

  const data = period === 'daily' ? dailyData : period === 'weekly' ? weeklyData : monthlyData

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Sales Trends</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('daily')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              period === 'daily'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setPeriod('weekly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              period === 'weekly'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              period === 'monthly'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-500">
          No sales data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey={period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month'} 
              tick={{ fontSize: 12 }}
              angle={period === 'daily' ? -45 : 0}
              textAnchor={period === 'daily' ? 'end' : 'middle'}
              height={period === 'daily' ? 80 : 30}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip 
              formatter={(value: number) => [`₦${value.toFixed(2)}`, 'Sales']}
              contentStyle={{ backgroundColor: '#fff', color: '#000', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="sales" 
              stroke="#4f46e5" 
              strokeWidth={2}
              name="Total Sales"
              dot={{ fill: '#4f46e5', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

