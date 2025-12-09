'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { exportToExcel, exportToPDF, exportToCSV, formatCurrency, formatDate } from '@/lib/export-utils'
import { Sale, Item, Expense, Organization } from '@/types/database'

export default function DashboardExportButton() {
  const [exporting, setExporting] = useState(false)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showDatePicker, setShowDatePicker] = useState(false)

  useEffect(() => {
    fetchOrganization()
  }, [])

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

  const handleExport = async (exportFormat: 'excel' | 'pdf' | 'csv') => {
    setExporting(true)
    try {
      // Get user's organization_id
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
        alert('Start date cannot be after end date')
        setExporting(false)
        return
      }

      const today = format(new Date(), 'yyyy-MM-dd')
      if (startDate > today || endDate > today) {
        alert('Cannot export future dates')
        setExporting(false)
        return
      }

      // Fetch sales for date range
      let salesQuery = supabase
        .from('sales')
        .select('*, item:items(*)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true })
      
      if (organizationId) {
        salesQuery = salesQuery.eq('organization_id', organizationId)
      }
      
      const { data: sales } = await salesQuery

      // Fetch expenses for date range
      let expensesQuery = supabase
        .from('expenses')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true })
      
      if (organizationId) {
        expensesQuery = expensesQuery.eq('organization_id', organizationId)
      }
      
      const { data: expenses } = await expensesQuery

      // Calculate totals
      const totalSales = sales?.reduce((sum, sale) => sum + (sale.total_price || 0), 0) || 0
      const totalExpenses = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0

      // Calculate profit/loss by item
      const itemMap = new Map<string, {
        item: Item
        quantity: number
        totalSelling: number
        totalCost: number
        profit: number
      }>()

      sales?.forEach((sale: Sale & { item?: Item }) => {
        if (!sale.item) return

        const existing = itemMap.get(sale.item_id) || {
          item: sale.item,
          quantity: 0,
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

      const profitLossDetails = Array.from(itemMap.values())
      const totalCost = profitLossDetails.reduce((sum, d) => sum + d.totalCost, 0)
      const grossProfit = totalSales - totalCost
      const netProfit = grossProfit - totalExpenses

      // Prepare export data
      const exportDateRangeLabel = startDate === endDate 
        ? formatDate(startDate)
        : `${formatDate(startDate)} - ${formatDate(endDate)}`

      // Section 1: Summary
      const summaryData = [
        ['DASHBOARD SUMMARY REPORT'],
        [`Date Range: ${exportDateRangeLabel}`],
        [],
        ['METRIC', 'AMOUNT'],
        ['Total Sales', formatCurrency(totalSales)],
        ['Total Cost of Goods Sold', formatCurrency(totalCost)],
        ['Gross Profit', formatCurrency(grossProfit)],
        ['Total Expenses', formatCurrency(totalExpenses)],
        ['Net Profit', formatCurrency(netProfit)],
        [],
      ]

      // Section 2: Sales Details
      const salesHeaders = ['Date', 'Item', 'Quantity', 'Unit', 'Price/Unit', 'Total Price', 'Payment Mode', 'Description']
      const salesData = (sales || []).map((sale: Sale & { item?: Item }) => [
        formatDate(sale.date),
        sale.item?.name || '-',
        sale.quantity.toString(),
        sale.item?.unit || '',
        formatCurrency(sale.price_per_unit),
        formatCurrency(sale.total_price),
        sale.payment_mode || '-',
        sale.description || '-',
      ])
      const salesTotalRow = ['TOTAL', '', '', '', '', formatCurrency(totalSales), '', '']
      const salesSection = [
        [],
        ['SALES DETAILS'],
        salesHeaders,
        ...salesData,
        salesTotalRow,
        [],
      ]

      // Section 3: Profit & Loss by Item
      const plHeaders = ['Item', 'Quantity', 'Unit', 'Total Sales', 'Total Cost', 'Profit']
      const plData = profitLossDetails.map(detail => [
        detail.item.name,
        detail.quantity.toString(),
        detail.item.unit,
        formatCurrency(detail.totalSelling),
        formatCurrency(detail.totalCost),
        formatCurrency(detail.profit),
      ])
      const plTotalRow = ['TOTAL', '', '', formatCurrency(totalSales), formatCurrency(totalCost), formatCurrency(grossProfit)]
      const plSection = [
        [],
        ['PROFIT & LOSS BY ITEM'],
        plHeaders,
        ...plData,
        plTotalRow,
        [],
      ]

      // Section 4: Expenses
      const expensesHeaders = ['Date', 'Description', 'Category', 'Amount']
      const expensesData = (expenses || []).map((exp: Expense) => [
        formatDate(exp.date),
        exp.description,
        exp.category || '-',
        formatCurrency(exp.amount),
      ])
      const expensesTotalRow = ['TOTAL', '', '', formatCurrency(totalExpenses)]
      const expensesSection = [
        [],
        ['EXPENSES'],
        expensesHeaders,
        ...expensesData,
        expensesTotalRow,
      ]

      // Combine all sections
      const allData = [
        ...summaryData,
        ...salesSection,
        ...plSection,
        ...expensesSection,
      ]

      const options = {
        title: 'Dashboard Summary Report',
        subtitle: `Date Range: ${exportDateRangeLabel}`,
        organizationName: organization?.name || undefined,
        filename: `dashboard-report-${startDate}-${endDate}.${exportFormat === 'excel' ? 'xlsx' : exportFormat}`,
      }

      if (exportFormat === 'excel') {
        exportToExcel(allData, [], options)
      } else if (exportFormat === 'pdf') {
        exportToPDF(allData, [], options)
      } else {
        exportToCSV(allData, [], options)
      }
    } catch (error) {
      console.error('Error exporting dashboard data:', error)
      alert('Failed to export dashboard data. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const dateRangeLabel = startDate === endDate 
    ? formatDate(startDate)
    : `${formatDate(startDate)} - ${formatDate(endDate)}`

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center gap-1"
          title="Select Date Range"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {dateRangeLabel}
        </button>
        <button
          onClick={() => handleExport('excel')}
          disabled={exporting}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export Dashboard to Excel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exporting ? 'Exporting...' : 'Excel'}
        </button>
        <button
          onClick={() => handleExport('pdf')}
          disabled={exporting}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export Dashboard to PDF"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          {exporting ? 'Exporting...' : 'PDF'}
        </button>
        <button
          onClick={() => handleExport('csv')}
          disabled={exporting}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export Dashboard to CSV"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exporting ? 'Exporting...' : 'CSV'}
        </button>
      </div>

      {showDatePicker && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDatePicker(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Select Date Range for Export</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="export-start-date" className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  id="export-start-date"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 cursor-pointer"
                />
              </div>
              <div>
                <label htmlFor="export-end-date" className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  id="export-end-date"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const today = format(new Date(), 'yyyy-MM-dd')
                    setStartDate(today)
                    setEndDate(today)
                  }}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(false)}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

