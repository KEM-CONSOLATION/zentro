'use client'

import { useState, useEffect } from 'react'
import { format, subDays } from 'date-fns'

interface StockReportItem {
  item_id: string
  item_name: string
  item_unit: string
  current_quantity: number
  opening_stock: number
  sales: number
  closing_stock: number
}

interface StockReport {
  date: string
  report: StockReportItem[]
}

export default function DailyStockReport({ type }: { type: 'opening' | 'closing' }) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [report, setReport] = useState<StockReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchReport()
  }, [selectedDate])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/stock/report?date=${selectedDate}`)
      const data = await response.json()
      if (data.success) {
        setReport(data)
      }
    } catch (error) {
      // Error fetching report
    } finally {
      setLoading(false)
    }
  }

  const isOpeningTime = currentTime.getHours() >= 8
  const isClosingTime = currentTime.getHours() >= 0 && currentTime.getHours() < 8

  return (
    <div>
      <div className="mb-6 bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
              Select Date
            </label>
            <input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-gray-900 cursor-pointer"
            />
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Current Time</p>
            <p className="text-lg font-semibold text-gray-900">
              {format(currentTime, 'HH:mm:ss')}
            </p>
            {type === 'opening' && (
              <p className={`text-xs mt-1 ${isOpeningTime ? 'text-green-600' : 'text-gray-500'}`}>
                {isOpeningTime ? '✓ Opening stock available' : 'Opening stock available at 8:00 AM'}
              </p>
            )}
            {type === 'closing' && (
              <p className={`text-xs mt-1 ${isClosingTime ? 'text-green-600' : 'text-gray-500'}`}>
                {isClosingTime ? '✓ Closing stock available' : 'Closing stock available at 12:00 AM'}
              </p>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-500">Loading report...</p>
        </div>
      ) : report && report.report.length > 0 ? (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              {type === 'opening' ? 'Opening Stock' : 'Closing Stock'} - {format(new Date(selectedDate), 'MMM dd, yyyy')}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {type === 'opening'
                ? 'Automatically calculated from previous day\'s closing stock'
                : 'Automatically calculated: Opening Stock - Sales'}
            </p>
          </div>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  {type === 'opening' && (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Opening Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Quantity
                      </th>
                    </>
                  )}
                  {type === 'closing' && (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Opening Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sales/Usage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Closing Stock
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {report.report.map((item) => (
                  <tr key={item.item_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.item_name}
                    </td>
                    {type === 'opening' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-medium">{item.opening_stock}</span> {item.item_unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.current_quantity} {item.item_unit}
                        </td>
                      </>
                    )}
                    {type === 'closing' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-medium">{item.opening_stock}</span> {item.item_unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.sales} {item.item_unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-medium">{item.closing_stock}</span> {item.item_unit}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-gray-500">No items found. Add items to see stock reports.</p>
        </div>
      )}
    </div>
  )
}

