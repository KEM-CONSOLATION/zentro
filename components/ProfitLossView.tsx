'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Sale, Item, Expense, Organization } from '@/types/database'
import { format } from 'date-fns'
import { exportToExcel, exportToPDF, exportToCSV, formatCurrency, formatDate } from '@/lib/export-utils'

export default function ProfitLossView() {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [totalSales, setTotalSales] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [netProfit, setNetProfit] = useState(0)
  const [organization, setOrganization] = useState<Organization | null>(null)
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
    fetchOrganization()
  }, [startDate, endDate])

  const fetchOrganization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single()
        
        if (profile?.organization_id) {
          const { data: org } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profile.organization_id)
            .single()
          setOrganization(org)
        }
      }
    } catch (error) {
      console.error('Error fetching organization:', error)
    }
  }

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
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (format: 'excel' | 'pdf' | 'csv') => {
    const dateRangeLabel = startDate === endDate 
      ? formatDate(startDate)
      : `${formatDate(startDate)} - ${formatDate(endDate)}`

    const headers = ['Item', 'Quantity', 'Unit', 'Selling Price', 'Cost Price', 'Total Sales', 'Total Cost', 'Profit']
    const data = salesDetails.map(detail => [
      detail.item.name,
      detail.quantity,
      detail.item.unit,
      formatCurrency(detail.sellingPrice),
      formatCurrency(detail.costPrice),
      formatCurrency(detail.totalSelling),
      formatCurrency(detail.totalCost),
      formatCurrency(detail.profit),
    ])

    // Add summary row
    const summaryRow = [
      'TOTAL',
      '',
      '',
      '',
      '',
      formatCurrency(totalSales),
      formatCurrency(totalCost),
      formatCurrency(totalProfit),
    ]
    const expensesRow = ['', '', '', '', '', 'Expenses:', formatCurrency(totalExpenses), '']
    const netProfitRow = ['', '', '', '', '', 'Net Profit:', formatCurrency(netProfit), '']

    const exportData = [...data, [], summaryRow, expensesRow, netProfitRow]

    const options = {
      title: 'Profit & Loss Report',
      subtitle: `Date Range: ${dateRangeLabel}`,
      organizationName: organization?.name || undefined,
      filename: `profit-loss-${startDate}-${endDate}.${format === 'excel' ? 'xlsx' : format}`,
    }

    if (format === 'excel') {
      exportToExcel(exportData, headers, options)
    } else if (format === 'pdf') {
      exportToPDF(exportData, headers, options)
    } else {
      exportToCSV(exportData, headers, options)
    }
  }

  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Profit & Loss Report</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('excel')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2"
              title="Export to Excel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excel
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-2"
              title="Export to PDF"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
              title="Export to CSV"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="profit-start-date" className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              id="profit-start-date"
              type="date"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-gray-900 cursor-pointer"
            />
          </div>
          <div>
            <label htmlFor="profit-end-date" className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              id="profit-end-date"
              type="date"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-gray-900 cursor-pointer"
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm text-gray-500">
            Showing data from {startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} to ${formatDate(endDate)}`}
          </p>
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
            Reset to Today
          </button>
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

