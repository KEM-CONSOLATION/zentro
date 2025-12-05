'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase/client'

// Helper function to safely format date
const formatDateSafely = (dateString: string): string => {
  if (!dateString || !dateString.trim()) return 'N/A'
  try {
    const date = new Date(dateString + 'T00:00:00')
    if (isNaN(date.getTime())) return 'Invalid Date'
    return format(date, 'MMM dd, yyyy')
  } catch {
    return 'Invalid Date'
  }
}

interface StockReportItem {
  item_id: string
  item_name: string
  item_unit: string
  current_quantity: number
  opening_stock: number
  opening_stock_source?: 'previous_closing_stock' | 'item_quantity' | 'manual_entry'
  opening_stock_cost_price?: number | null
  opening_stock_selling_price?: number | null
  restocking?: number
  sales: number
  waste_spoilage?: number
  closing_stock: number
  opening_stock_manual?: boolean
  closing_stock_manual?: boolean
}

interface EditingItemData {
  quantity?: number
  cost_price?: number
  selling_price?: number
}

interface StockReport {
  date: string
  report: StockReportItem[]
}

export default function DailyStockReport({ type }: { type: 'opening' | 'closing' }) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [selectedDate, setSelectedDate] = useState(() => {
    try {
      return format(new Date(), 'yyyy-MM-dd')
    } catch {
      return new Date().toISOString().split('T')[0]
    }
  })
  const [report, setReport] = useState<StockReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [editingItems, setEditingItems] = useState<Record<string, EditingItemData>>({})
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null)
  const isPastDate = selectedDate < today
  const syncingRef = useRef(false) // Prevent infinite loops from sync operations

  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (profile) {
          setUserRole(profile.role)
        }
      }
    }
    checkUserRole()
  }, [])

  useEffect(() => {
    // Set initial time only on client to avoid hydration mismatch
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    syncingRef.current = false // Reset sync flag when date changes
    fetchReport()
    setEditingItems({}) // Reset editing state when date changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/stock/report?date=${selectedDate}`)
      const data = await response.json()
      if (data.success) {
        setReport(data)
        
        // Auto-save/auto-create for today's date
        if (selectedDate === today) {
          // Auto-save closing stock if viewing closing stock report
          if (type === 'closing') {
            await autoSaveClosingStock()
          }
          
          // Auto-create opening stock if viewing opening stock report
          if (type === 'opening') {
            await autoCreateOpeningStock()
          }
        } else if (isPastDate && type === 'closing' && data.report && data.report.length > 0) {
          // For past dates: Auto-calculate and save closing stock if it doesn't exist
          // This ensures closing stock is always calculated from opening stock + restocking - sales - waste/spoilage
          await autoCalculatePastClosingStock(data)
        } else if (isPastDate && type === 'opening' && !syncingRef.current) {
          // For past dates opening stock: Ensure it matches previous day's closing stock
          // This maintains consistency: closing stock of one day = opening stock of next day
          syncingRef.current = true // Set flag to prevent recursive calls
          const result = await ensureOpeningStockMatchesPreviousClosing(selectedDate)
          syncingRef.current = false // Reset flag after sync
          // Only refresh if update was successful and we're not in a manual sync
          if (result.success && result.updated && result.updated > 0) {
            // Don't call fetchReport here to avoid infinite loop - the data is already updated
          }
        } else if (isPastDate && type === 'closing') {
          // For past dates closing stock: Also ensure opening stock for next day matches this closing stock
          // This maintains the chain: this closing stock → next day's opening stock
          const nextDate = new Date(selectedDate + 'T00:00:00')
          nextDate.setDate(nextDate.getDate() + 1)
          const nextDateStr = nextDate.toISOString().split('T')[0]
          const today = format(new Date(), 'yyyy-MM-dd')
          if (nextDateStr <= today) {
            // Use cascade update to ensure next day's opening stock matches this closing stock
            try {
              const { data: { user } } = await supabase.auth.getUser()
              if (user) {
                const response = await fetch('/api/stock/cascade-update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ start_date: selectedDate, user_id: user.id }),
                })
                // Silently handle - don't interrupt user experience
                if (!response.ok) {
                  console.error('Cascade update failed')
                }
              }
            } catch (error) {
              console.error('Failed to cascade update after viewing closing stock:', error)
            }
          }
        }
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const autoSaveClosingStock = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check if closing stock already exists for this date
      const { data: existingClosing } = await supabase
        .from('closing_stock')
        .select('id')
        .eq('date', selectedDate)
        .limit(1)

      // Only auto-save if no closing stock exists yet
      if (!existingClosing || existingClosing.length === 0) {
        const response = await fetch('/api/stock/auto-save-closing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: selectedDate, user_id: user.id }),
        })

        const result = await response.json()
        if (result.success) {
          // Refresh the report to show saved values
          const reportResponse = await fetch(`/api/stock/report?date=${selectedDate}`)
          const reportData = await reportResponse.json()
          if (reportData.success) {
            setReport(reportData)
          }
        }
      }
    } catch (error) {
      // Silently fail - don't interrupt user experience
      console.error('Auto-save closing stock failed:', error)
    }
  }

  const ensureOpeningStockMatchesPreviousClosing = async (date: string): Promise<{ success: boolean; updated?: number; error?: Error }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { success: false, error: new Error('User not found') }

      // Calculate previous date
      const dateObj = new Date(date + 'T00:00:00')
      const prevDate = new Date(dateObj)
      prevDate.setDate(prevDate.getDate() - 1)
      const prevDateStr = prevDate.toISOString().split('T')[0]

      // Get previous day's closing stock
      const { data: prevClosingStock } = await supabase
        .from('closing_stock')
        .select('item_id, quantity')
        .eq('date', prevDateStr)

      if (!prevClosingStock || prevClosingStock.length === 0) {
        // No previous closing stock, nothing to sync
        return { success: true, updated: 0 }
      }

      // Get current opening stock for this date
      const { data: currentOpeningStock } = await supabase
        .from('opening_stock')
        .select('item_id, quantity, cost_price, selling_price')
        .eq('date', date)

      // Get previous day's opening stock for prices
      const { data: prevOpeningStock } = await supabase
        .from('opening_stock')
        .select('item_id, cost_price, selling_price')
        .eq('date', prevDateStr)

      // Get all items
      const { data: items } = await supabase
        .from('items')
        .select('*')
        .order('name')

      if (!items) return { success: false, error: new Error('Items not found') }

      // Update opening stock to match previous day's closing stock
      const openingStockToUpsert = items
        .filter((item) => {
          const hasClosingStock = prevClosingStock.some((cs) => cs.item_id === item.id)
          return hasClosingStock
        })
        .map((item) => {
          const closing = prevClosingStock.find((cs) => cs.item_id === item.id)
          const currentOpening = currentOpeningStock?.find((os) => os.item_id === item.id)
          const prevOpening = prevOpeningStock?.find((os) => os.item_id === item.id)

          // ALWAYS use previous day's closing stock as opening stock
          const openingQty = closing ? parseFloat(closing.quantity.toString()) : item.quantity

          // Use prices from previous day's opening stock, or item's current prices
          const costPrice = prevOpening?.cost_price ?? currentOpening?.cost_price ?? item.cost_price
          const sellingPrice = prevOpening?.selling_price ?? currentOpening?.selling_price ?? item.selling_price

          const isUpdate = currentOpening && currentOpening.quantity !== openingQty

          return {
            item_id: item.id,
            quantity: openingQty,
            cost_price: costPrice,
            selling_price: sellingPrice,
            date,
            recorded_by: user.id,
            notes: closing
              ? isUpdate
                ? `Auto-updated to match previous day's closing stock (${prevDateStr}). Previous value: ${currentOpening?.quantity || 'N/A'}`
                : `Auto-created from previous day's closing stock (${prevDateStr})`
              : `Auto-created from item quantity`,
          }
        })

      if (openingStockToUpsert.length > 0) {
        // Check if any updates are actually needed
        const needsUpdate = openingStockToUpsert.some((newStock) => {
          const existing = currentOpeningStock?.find((os) => os.item_id === newStock.item_id)
          return !existing || existing.quantity !== newStock.quantity
        })

        if (needsUpdate) {
          // Upsert opening stock records
          const { error: upsertError } = await supabase
            .from('opening_stock')
            .upsert(openingStockToUpsert, {
              onConflict: 'item_id,date',
            })

          if (!upsertError) {
            return { success: true, updated: openingStockToUpsert.length }
          }
        }
      }
      return { success: true, updated: 0 }
    } catch (error) {
      console.error('Failed to ensure opening stock matches previous closing:', error)
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) }
    }
  }

  const handleRecalculateOpeningStock = async () => {
    if (type !== 'opening' || !isPastDate) return

    if (!confirm('This will:\n1. Recalculate the previous day\'s closing stock (Opening + Restocking - Sales - Waste/Spoilage)\n2. Use that calculated closing stock as this day\'s opening stock\n\nContinue?')) {
      return
    }

    setCalculating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('You must be logged in to recalculate opening stock.')
        return
      }

      // Calculate previous date
      const dateObj = new Date(selectedDate + 'T00:00:00')
      const prevDate = new Date(dateObj)
      prevDate.setDate(prevDate.getDate() - 1)
      const prevDateStr = prevDate.toISOString().split('T')[0]

      // Step 1: First, recalculate the previous day's closing stock
      // This ensures we have the correct closing stock based on all transactions
      const closingStockResponse = await fetch('/api/stock/auto-save-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: prevDateStr,
          user_id: user.id,
        }),
      })

      const closingStockResult = await closingStockResponse.json()
      
      if (!closingStockResult.success) {
        alert(`Failed to recalculate previous day's closing stock. Please ensure all transactions for ${prevDateStr} are recorded.`)
        return
      }

      // Step 2: Now use the recalculated closing stock as this day's opening stock
      const result = await ensureOpeningStockMatchesPreviousClosing(selectedDate)
      
      if (result.success) {
        if (result.updated && result.updated > 0) {
          alert(`Successfully recalculated!\n\nPrevious day (${prevDateStr}) closing stock recalculated.\n${result.updated} item(s) updated to match previous day's closing stock.`)
          // Refresh the report to show updated values
          await fetchReport()
        } else {
          alert('Opening stock already matches previous day\'s closing stock. No changes needed.')
        }
      } else {
        alert('Failed to update opening stock. Please try again.')
      }
    } catch (error) {
      alert('An error occurred while recalculating opening stock.')
      console.error('Recalculate opening stock error:', error)
    } finally {
      setCalculating(false)
    }
  }

  const autoCreateOpeningStock = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check if opening stock already exists for this date
      const { data: existingOpening } = await supabase
        .from('opening_stock')
        .select('id')
        .eq('date', selectedDate)
        .limit(1)

      // Only auto-create if no opening stock exists yet
      if (!existingOpening || existingOpening.length === 0) {
        const response = await fetch('/api/stock/auto-create-opening', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: selectedDate, user_id: user.id }),
        })

        const result = await response.json()
        if (result.success && result.records_created > 0) {
          // Refresh the report to show created values
          const reportResponse = await fetch(`/api/stock/report?date=${selectedDate}`)
          const reportData = await reportResponse.json()
          if (reportData.success) {
            setReport(reportData)
          }
        }
      }
    } catch (error) {
      // Silently fail - don't interrupt user experience
      console.error('Auto-create opening stock failed:', error)
    }
  }

  const autoCalculatePastClosingStock = async (reportData?: StockReport) => {
    // Use provided report data or current report state
    const dataToUse = reportData || report
    if (!dataToUse || !dataToUse.report || dataToUse.report.length === 0) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check if closing stock already exists for this date
      const { data: existingClosing } = await supabase
        .from('closing_stock')
        .select('item_id')
        .eq('date', selectedDate)
        .limit(1)

      // If closing stock already exists (manually entered), don't auto-calculate
      // This preserves manual overrides
      if (existingClosing && existingClosing.length > 0) {
        return
      }

      // Auto-calculate and save closing stock using the same API
      const response = await fetch('/api/stock/auto-save-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          user_id: user.id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Refresh the report to show the calculated values
        await fetchReport()
      }
      // Silently fail if there's an error - user can still manually calculate
    } catch {
      // Silently fail - user can still manually calculate or enter values
    }
  }


  const handleAutoCalculateClosing = async () => {
    if (type !== 'closing' || !isPastDate) return

    setCalculating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('You must be logged in to calculate closing stock.')
        return
      }

      const response = await fetch('/api/stock/auto-save-closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          user_id: user.id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Trigger cascade update to sync opening stock for next day BEFORE showing success message
        try {
          const response = await fetch('/api/stock/cascade-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ start_date: selectedDate, user_id: user.id }),
          })
          if (!response.ok) {
            console.error('Cascade update failed')
          }
        } catch (error) {
          console.error('Cascade update failed:', error)
        }
        
        alert(`Successfully calculated and saved closing stock for ${formatDateSafely(selectedDate)}.\n\nFormula: Opening Stock + Restocking - Sales - Waste/Spoilage\n\nOpening stock for the next day has been automatically updated.`)
        setEditingItems({})
        await fetchReport()
      } else {
        alert(`Error: ${result.error || 'Failed to calculate closing stock'}`)
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to calculate closing stock'}`)
    } finally {
      setCalculating(false)
    }
  }

  const handleManualSave = async () => {
    if (!report) return

    // Only admins can save stock
    if (userRole !== 'admin') {
      alert('Only administrators can record opening and closing stock.')
      return
    }

    // Closing stock should only be calculated, not manually saved
    if (type === 'closing') {
      alert('Closing stock is automatically calculated. Please use "Calculate & Save Closing Stock" button instead.')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('You must be logged in to save stock')
        return
      }

      const itemsToSave = report.report.map((item) => {
        const editingData = editingItems[item.item_id] || {}
        const baseData: {
          item_id: string
          quantity: number
          cost_price?: number | null
          selling_price?: number | null
        } = {
          item_id: item.item_id,
          quantity: editingData.quantity ?? item.opening_stock,
        }
        
        // Only include prices for opening stock
        if (editingData.cost_price !== undefined) {
          baseData.cost_price = editingData.cost_price
        } else if (item.opening_stock_cost_price !== undefined) {
          baseData.cost_price = item.opening_stock_cost_price
        }
        
        if (editingData.selling_price !== undefined) {
          baseData.selling_price = editingData.selling_price
        } else if (item.opening_stock_selling_price !== undefined) {
          baseData.selling_price = item.opening_stock_selling_price
        }
        
        return baseData
      })

      const endpoint = '/api/stock/manual-opening'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          items: itemsToSave,
          user_id: user.id,
        }),
      })

      const result = await response.json()
      if (result.success) {
        setEditingItems({})
        await fetchReport()
        alert(`Successfully saved ${type === 'opening' ? 'opening' : 'closing'} stock for ${formatDateSafely(selectedDate)}`)
      } else {
        alert(`Error: ${result.error || 'Failed to save stock'}`)
      }
    } catch (error) {
      console.error('Manual save failed:', error)
      alert('Failed to save stock. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleValueChange = (itemId: string, field: 'quantity' | 'cost_price' | 'selling_price', value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0) {
      setEditingItems((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          [field]: numValue,
        },
      }))
    } else if (value === '') {
      // Allow clearing the value
      setEditingItems((prev) => {
        const updated = { ...prev[itemId] }
        delete updated[field]
        return { ...prev, [itemId]: updated }
      })
    }
  }

  const isOpeningTime = currentTime ? currentTime.getHours() >= 8 : false
  const isClosingTime = currentTime ? currentTime.getHours() >= 0 && currentTime.getHours() < 8 : false

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
              max={today}
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
              disabled={userRole !== 'admin'}
              className={`px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-gray-900 ${
                userRole !== 'admin' ? 'bg-gray-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            />
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Current Time</p>
            <p className="text-lg font-semibold text-gray-900" suppressHydrationWarning>
              {currentTime ? format(currentTime, 'HH:mm:ss') : '--:--:--'}
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
              {type === 'opening' ? 'Opening Stock' : 'Closing Stock'} - {formatDateSafely(selectedDate)}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isPastDate
                ? type === 'opening'
                  ? `Manual entry mode for ${formatDateSafely(selectedDate)}. Enter values and click Save.`
                  : `Automatically calculated for ${formatDateSafely(selectedDate)}: Opening Stock + Restocking - Sales - Waste/Spoilage.`
                : type === 'opening'
                ? 'Automatically calculated from previous day\'s closing stock. If no closing stock exists, falls back to item\'s current quantity.'
                : 'Automatically calculated: Opening Stock + Restocking - Sales - Waste/Spoilage'}
            </p>
            {isPastDate && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  <strong>Past Date Entry:</strong> {type === 'opening' 
                    ? 'You can manually enter opening stock values for this date. You can also enter cost price and selling price for historical accuracy, as prices change per day.' 
                    : 'Closing stock is automatically calculated from Opening Stock + Restocking - Sales - Waste/Spoilage. Click "Calculate & Save Closing Stock" to recalculate. The next day\'s opening stock will be automatically updated to match this closing stock.'}
                </p>
              </div>
            )}
            {type === 'opening' && report.report.some(item => item.opening_stock_source === 'item_quantity') && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Some items are using their current quantity as opening stock because no closing stock was recorded for the previous day. 
                  Make sure to save closing stock records at the end of each day for accurate opening stock calculations.
                </p>
              </div>
            )}
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
                      {isPastDate && (
                        <>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cost Price (₦)
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Selling Price (₦)
                          </th>
                        </>
                      )}
                      {!isPastDate && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Quantity
                      </th>
                      )}
                    </>
                  )}
                  {type === 'closing' && (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Opening Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Restocking
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sales/Usage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Waste/Spoilage
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
                          {isPastDate ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editingItems[item.item_id]?.quantity ?? item.opening_stock}
                                onChange={(e) => handleValueChange(item.item_id, 'quantity', e.target.value)}
                                disabled={userRole !== 'admin'}
                                className={`w-24 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 ${
                                  userRole !== 'admin' ? 'bg-gray-50 cursor-not-allowed' : ''
                                }`}
                              />
                              <span className="text-gray-500">{item.item_unit}</span>
                              {item.opening_stock_manual && (
                                <span className="text-xs text-blue-600" title="Manually entered">
                                  ✏️
                                </span>
                              )}
                            </div>
                          ) : (
                            <>
                          <span className="font-medium">{item.opening_stock}</span> {item.item_unit}
                              {item.opening_stock_source === 'item_quantity' && (
                                <span className="ml-2 text-xs text-yellow-600" title="Using item quantity because no closing stock found for previous day">
                                  ⚠
                                </span>
                              )}
                            </>
                          )}
                        </td>
                        {isPastDate && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={
                                  editingItems[item.item_id]?.cost_price !== undefined
                                    ? editingItems[item.item_id].cost_price
                                    : item.opening_stock_cost_price ?? ''
                                }
                                onChange={(e) => handleValueChange(item.item_id, 'cost_price', e.target.value)}
                                placeholder="0.00"
                                disabled={userRole !== 'admin'}
                                className={`w-28 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 ${
                                  userRole !== 'admin' ? 'bg-gray-50 cursor-not-allowed' : ''
                                }`}
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={
                                  editingItems[item.item_id]?.selling_price !== undefined
                                    ? editingItems[item.item_id].selling_price
                                    : item.opening_stock_selling_price ?? ''
                                }
                                onChange={(e) => handleValueChange(item.item_id, 'selling_price', e.target.value)}
                                placeholder="0.00"
                                disabled={userRole !== 'admin'}
                                className={`w-28 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 ${
                                  userRole !== 'admin' ? 'bg-gray-50 cursor-not-allowed' : ''
                                }`}
                              />
                            </td>
                          </>
                        )}
                        {!isPastDate && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.current_quantity} {item.item_unit}
                        </td>
                        )}
                      </>
                    )}
                    {type === 'closing' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="font-medium">{item.opening_stock}</span> {item.item_unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                          <span className="font-medium">+{item.restocking || 0}</span> {item.item_unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.sales} {item.item_unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                          <span className="font-medium">-{item.waste_spoilage || 0}</span> {item.item_unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {/* Closing stock is always auto-calculated - show as read-only */}
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{item.closing_stock}</span>
                            <span className="text-gray-500">{item.item_unit}</span>
                            <span className="text-xs text-green-600" title="Auto-calculated: Opening + Restocking - Sales - Waste/Spoilage">
                              ✓
                            </span>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isPastDate && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
              {userRole === 'admin' ? (
                <>
                  {type === 'closing' ? (
                    <button
                      onClick={handleAutoCalculateClosing}
                      disabled={saving || calculating}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Calculate closing stock from: Opening Stock + Restocking - Sales - Waste/Spoilage. This will also update the next day's opening stock."
                    >
                      {calculating ? 'Calculating...' : 'Calculate & Save Closing Stock'}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleRecalculateOpeningStock}
                        disabled={saving || calculating}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Recalculate opening stock from previous day's closing stock"
                      >
                        {calculating ? 'Recalculating...' : 'Recalculate from Previous Day\'s Closing Stock'}
                      </button>
                      <button
                        onClick={handleManualSave}
                        disabled={saving || calculating || Object.keys(editingItems).length === 0}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-auto"
                      >
                        {saving ? 'Saving...' : 'Save Opening Stock'}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 italic">Only administrators can record opening and closing stock.</p>
              )}
            </div>
          )}
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

