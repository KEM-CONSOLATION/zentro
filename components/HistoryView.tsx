'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { Item, OpeningStock, ClosingStock, Sale, Profile, Organization } from '@/types/database'
import { exportToExcel, exportToPDF, exportToCSV, formatCurrency, formatDate } from '@/lib/export-utils'

export default function HistoryView() {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [openingStocks, setOpeningStocks] = useState<(OpeningStock & { item?: Item; recorded_by_profile?: Profile })[]>([])
  const [closingStocks, setClosingStocks] = useState<(ClosingStock & { item?: Item; recorded_by_profile?: Profile })[]>([])
  const [sales, setSales] = useState<(Sale & { item?: Item; recorded_by_profile?: Profile })[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'opening' | 'closing' | 'sales'>('opening')
  const [organization, setOrganization] = useState<Organization | null>(null)

  useEffect(() => {
    fetchData()
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

  const fetchData = async () => {
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
        alert('Start date cannot be after end date')
        setEndDate(startDate)
        return
      }

      const today = format(new Date(), 'yyyy-MM-dd')
      if (startDate > today || endDate > today) {
        alert('Cannot select future dates')
        setStartDate(today)
        setEndDate(today)
        return
      }

      // Fetch opening stock for date range
      let openingQuery = supabase
        .from('opening_stock')
        .select('*, item:items(*), recorded_by_profile:profiles(*)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      
      if (organizationId) {
        openingQuery = openingQuery.eq('organization_id', organizationId)
      }
      
      const { data: openingData } = await openingQuery

      if (openingData) {
        setOpeningStocks(openingData as (OpeningStock & { item?: Item; recorded_by_profile?: Profile })[])
      }

      // Fetch closing stock for date range
      let closingQuery = supabase
        .from('closing_stock')
        .select('*, item:items(*), recorded_by_profile:profiles(*)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      
      if (organizationId) {
        closingQuery = closingQuery.eq('organization_id', organizationId)
      }
      
      const { data: closingData } = await closingQuery

      if (closingData) {
        setClosingStocks(closingData as (ClosingStock & { item?: Item; recorded_by_profile?: Profile })[])
      }

      // Fetch sales for date range
      let salesQuery = supabase
        .from('sales')
        .select('*, item:items(*), recorded_by_profile:profiles(*)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      
      if (organizationId) {
        salesQuery = salesQuery.eq('organization_id', organizationId)
      }
      
      const { data: salesData } = await salesQuery

      if (salesData) {
        setSales(salesData as (Sale & { item?: Item; recorded_by_profile?: Profile })[])
      }
    } catch (error) {
      console.error('Error fetching history data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateTotalSales = () => {
    return sales.reduce((sum, sale) => sum + (sale.total_price || 0), 0)
  }

  const handleExport = (format: 'excel' | 'pdf' | 'csv') => {
    const dateRangeLabel = startDate === endDate 
      ? formatDate(startDate)
      : `${formatDate(startDate)} - ${formatDate(endDate)}`

    if (activeTab === 'opening') {
      const headers = ['Date', 'Item', 'Quantity', 'Unit', 'Recorded By']
      const data = openingStocks.map(stock => [
        formatDate(stock.date),
        stock.item?.name || '-',
        stock.quantity.toString(),
        stock.item?.unit || '',
        stock.recorded_by_profile?.full_name || stock.recorded_by_profile?.email || 'Unknown',
      ])

      const options = {
        title: 'Opening Stock History',
        subtitle: `Date Range: ${dateRangeLabel}`,
        organizationName: organization?.name || undefined,
        filename: `opening-stock-${startDate}-${endDate}.${format === 'excel' ? 'xlsx' : format}`,
      }

      if (format === 'excel') {
        exportToExcel(data, headers, options)
      } else if (format === 'pdf') {
        exportToPDF(data, headers, options)
      } else {
        exportToCSV(data, headers, options)
      }
    } else if (activeTab === 'closing') {
      const headers = ['Date', 'Item', 'Quantity', 'Unit', 'Recorded By']
      const data = closingStocks.map(stock => [
        formatDate(stock.date),
        stock.item?.name || '-',
        stock.quantity.toString(),
        stock.item?.unit || '',
        stock.recorded_by_profile?.full_name || stock.recorded_by_profile?.email || 'Unknown',
      ])

      const options = {
        title: 'Closing Stock History',
        subtitle: `Date Range: ${dateRangeLabel}`,
        organizationName: organization?.name || undefined,
        filename: `closing-stock-${startDate}-${endDate}.${format === 'excel' ? 'xlsx' : format}`,
      }

      if (format === 'excel') {
        exportToExcel(data, headers, options)
      } else if (format === 'pdf') {
        exportToPDF(data, headers, options)
      } else {
        exportToCSV(data, headers, options)
      }
    } else if (activeTab === 'sales') {
      const headers = ['Date', 'Item', 'Quantity', 'Unit', 'Price/Unit', 'Total Price', 'Description', 'Recorded By']
      const data = sales.map(sale => [
        formatDate(sale.date),
        sale.item?.name || '-',
        sale.quantity.toString(),
        sale.item?.unit || '',
        formatCurrency(sale.price_per_unit),
        formatCurrency(sale.total_price),
        sale.description || '-',
        sale.recorded_by_profile?.full_name || sale.recorded_by_profile?.email || 'Unknown',
      ])

      // Add summary row
      const summaryRow = [
        '',
        'TOTAL',
        '',
        '',
        '',
        formatCurrency(calculateTotalSales()),
        '',
        '',
      ]
      const exportData = [...data, [], summaryRow]

      const options = {
        title: 'Sales/Usage History',
        subtitle: `Date Range: ${dateRangeLabel}`,
        organizationName: organization?.name || undefined,
        filename: `sales-history-${startDate}-${endDate}.${format === 'excel' ? 'xlsx' : format}`,
      }

      if (format === 'excel') {
        exportToExcel(exportData, headers, options)
      } else if (format === 'pdf') {
        exportToPDF(exportData, headers, options)
      } else {
        exportToCSV(exportData, headers, options)
      }
    }
  }

  const getDateRangeLabel = () => {
    if (startDate === endDate) {
      return format(new Date(startDate), 'MMM dd, yyyy')
    }
    return `${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}`
  }

  return (
    <div>
      <div className="mb-6 bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">History</h2>
          {(openingStocks.length > 0 || closingStocks.length > 0 || sales.length > 0) && (
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
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => {
                const newStartDate = e.target.value
                const today = format(new Date(), 'yyyy-MM-dd')
                if (newStartDate > today) {
                  alert('Cannot select future dates. Please select today or a past date.')
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
            <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              min={startDate}
              onChange={(e) => {
                const newEndDate = e.target.value
                const today = format(new Date(), 'yyyy-MM-dd')
                if (newEndDate > today) {
                  alert('Cannot select future dates. Please select today or a past date.')
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
        <div className="flex items-center justify-between mt-3">
          <p className="text-sm text-gray-500">
            Showing records from <span className="font-medium">{getDateRangeLabel()}</span>
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

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('opening')}
              className={`${
                activeTab === 'opening'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-pointer transition-colors`}
            >
              Opening Stock
            </button>
            <button
              onClick={() => setActiveTab('closing')}
              className={`${
                activeTab === 'closing'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-pointer transition-colors`}
            >
              Closing Stock
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`${
                activeTab === 'sales'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-pointer transition-colors`}
            >
              Sales/Usage
            </button>
          </nav>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-500">Loading data...</p>
        </div>
      ) : (
        <>
          {activeTab === 'opening' && (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Opening Stock - {getDateRangeLabel()}
              </h2>
              {openingStocks.length === 0 ? (
                <p className="text-gray-500">No opening stock records for this date range</p>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {openingStocks.map((stock) => (
                        <tr key={stock.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format(new Date(stock.date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {stock.item?.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {stock.quantity} {stock.item?.unit || ''}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {stock.recorded_by_profile?.full_name || stock.recorded_by_profile?.email}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'closing' && (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Closing Stock - {getDateRangeLabel()}
              </h2>
              {closingStocks.length === 0 ? (
                <p className="text-gray-500">No closing stock records for this date range</p>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {closingStocks.map((stock) => (
                        <tr key={stock.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format(new Date(stock.date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {stock.item?.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {stock.quantity} {stock.item?.unit || ''}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {stock.recorded_by_profile?.full_name || stock.recorded_by_profile?.email}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Sales/Usage - {getDateRangeLabel()}
                </h2>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Total Sales</p>
                  <p className="text-2xl font-bold text-indigo-600">₦{calculateTotalSales().toFixed(2)}</p>
                </div>
              </div>
              {sales.length === 0 ? (
                <p className="text-gray-500">No sales records for this date range</p>
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {sale.recorded_by_profile?.full_name || sale.recorded_by_profile?.email}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

