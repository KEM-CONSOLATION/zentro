'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { Item, OpeningStock, ClosingStock, Sale, Profile } from '@/types/database'

export default function HistoryView() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [openingStocks, setOpeningStocks] = useState<(OpeningStock & { item?: Item; recorded_by_profile?: Profile })[]>([])
  const [closingStocks, setClosingStocks] = useState<(ClosingStock & { item?: Item; recorded_by_profile?: Profile })[]>([])
  const [sales, setSales] = useState<(Sale & { item?: Item; recorded_by_profile?: Profile })[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'opening' | 'closing' | 'sales'>('opening')

  useEffect(() => {
    fetchData()
  }, [selectedDate])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: openingData } = await supabase
        .from('opening_stock')
        .select('*, item:items(*), recorded_by_profile:profiles(*)')
        .eq('date', selectedDate)
        .order('created_at', { ascending: false })

      if (openingData) {
        setOpeningStocks(openingData as (OpeningStock & { item?: Item; recorded_by_profile?: Profile })[])
      }

      const { data: closingData } = await supabase
        .from('closing_stock')
        .select('*, item:items(*), recorded_by_profile:profiles(*)')
        .eq('date', selectedDate)
        .order('created_at', { ascending: false })

      if (closingData) {
        setClosingStocks(closingData as (ClosingStock & { item?: Item; recorded_by_profile?: Profile })[])
      }

      const { data: salesData } = await supabase
        .from('sales')
        .select('*, item:items(*), recorded_by_profile:profiles(*)')
        .eq('date', selectedDate)
        .order('created_at', { ascending: false })

      if (salesData) {
        setSales(salesData as (Sale & { item?: Item; recorded_by_profile?: Profile })[])
      }
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  const calculateTotalSales = () => {
    return sales.reduce((sum, sale) => sum + (sale.total_price || 0), 0)
  }

  return (
    <div>
      <div className="mb-6 bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
          Select Date
        </label>
        <input
          id="date"
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
                Opening Stock - {format(new Date(selectedDate), 'MMM dd, yyyy')}
              </h2>
              {openingStocks.length === 0 ? (
                <p className="text-gray-500">No opening stock records for this date</p>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {openingStocks.map((stock) => (
                        <tr key={stock.id} className="hover:bg-gray-50 transition-colors">
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
                Closing Stock - {format(new Date(selectedDate), 'MMM dd, yyyy')}
              </h2>
              {closingStocks.length === 0 ? (
                <p className="text-gray-500">No closing stock records for this date</p>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {closingStocks.map((stock) => (
                        <tr key={stock.id} className="hover:bg-gray-50 transition-colors">
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
                  Sales/Usage - {format(new Date(selectedDate), 'MMM dd, yyyy')}
                </h2>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Total Sales</p>
                  <p className="text-2xl font-bold text-indigo-600">₦{calculateTotalSales().toFixed(2)}</p>
                </div>
              </div>
              {sales.length === 0 ? (
                <p className="text-gray-500">No sales records for this date</p>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
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

