'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Item, Restocking, Profile } from '@/types/database'
import { format } from 'date-fns'

export default function RestockingForm() {
  const [items, setItems] = useState<Item[]>([])
  const [restockings, setRestockings] = useState<(Restocking & { item?: Item; recorded_by_profile?: Profile })[]>([])
  const [selectedItem, setSelectedItem] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingRestocking, setEditingRestocking] = useState<Restocking | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null)
  const [openingStock, setOpeningStock] = useState<number | null>(null)
  const [currentTotal, setCurrentTotal] = useState<number | null>(null)

  useEffect(() => {
    fetchItems()
    fetchRestockings()
    checkUserRole()
    // Ensure date is always today for staff, but allow past dates for admins
    const today = format(new Date(), 'yyyy-MM-dd')
    if (userRole === 'staff') {
      setDate(today)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole])

  useEffect(() => {
    if (selectedItem && date) {
      fetchOpeningStockAndTotal()
    } else {
      setOpeningStock(null)
      setCurrentTotal(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem, date])

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

  const fetchItems = async () => {
    const { data } = await supabase.from('items').select('*').order('name')
    if (data) {
      setItems(data)
    }
  }

  const fetchOpeningStockAndTotal = async () => {
    try {
      // Get opening stock for the selected date
      const { data: openingData } = await supabase
        .from('opening_stock')
        .select('quantity')
        .eq('item_id', selectedItem)
        .eq('date', date)
        .single()

      const openingQty = openingData?.quantity || 0

      // Get total restocking for the date
      const { data: restockingData } = await supabase
        .from('restocking')
        .select('quantity')
        .eq('item_id', selectedItem)
        .eq('date', date)

      const totalRestocking = restockingData?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0

      // Get total sales for the date
      const { data: salesData } = await supabase
        .from('sales')
        .select('quantity')
        .eq('item_id', selectedItem)
        .eq('date', date)

      const totalSales = salesData?.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0) || 0

      // Current total = opening stock + restocking - sales
      const current = openingQty + totalRestocking - totalSales

      setOpeningStock(openingQty)
      setCurrentTotal(current)
    } catch (error) {
      // Fallback to 0 if calculation fails
      setOpeningStock(0)
      setCurrentTotal(0)
    }
  }

  const fetchRestockings = async () => {
    const { data, error } = await supabase
      .from('restocking')
      .select(`
        *,
        item:items(*),
        recorded_by_profile:profiles(*)
      `)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setRestockings(data)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      // Restrict restocking to today only for staff, allow past dates for admins
      const today = format(new Date(), 'yyyy-MM-dd')
      if (userRole !== 'admin' && date !== today) {
        setMessage({ type: 'error', text: 'Restocking can only be recorded for today\'s date. Please use today\'s date.' })
        setDate(today) // Reset to today
        setLoading(false)
        return
      }
      
      // Prevent future dates for everyone
      if (date > today) {
        setMessage({ type: 'error', text: 'Cannot record restocking for future dates.' })
        setDate(today)
        setLoading(false)
        return
      }

      const quantityValue = parseFloat(quantity)
      if (quantityValue <= 0) {
        setMessage({ type: 'error', text: 'Restocking quantity must be greater than 0' })
        setLoading(false)
        return
      }

      // Validate that restocking doesn't result in negative stock
      if (currentTotal !== null && currentTotal < 0) {
        setMessage({ type: 'error', text: 'Cannot restock: Current stock is negative. Please check your opening stock and sales records.' })
        setLoading(false)
        return
      }

      if (editingRestocking) {
        // Update existing restocking
        const { error } = await supabase
          .from('restocking')
          .update({
            item_id: selectedItem,
            quantity: quantityValue,
            date,
            notes: notes || null,
          })
          .eq('id', editingRestocking.id)

        if (error) throw error
        setMessage({ type: 'success', text: 'Restocking updated successfully!' })
        setEditingRestocking(null)
      } else {
        // Create new restocking
        const { error } = await supabase.from('restocking').insert({
          item_id: selectedItem,
          quantity: quantityValue,
          date,
          recorded_by: user.id,
          notes: notes || null,
        })

        if (error) throw error
        setMessage({ type: 'success', text: 'Restocking recorded successfully!' })
      }

      setQuantity('')
      setNotes('')
      setSelectedItem('')
      setDate(format(new Date(), 'yyyy-MM-dd'))
      fetchRestockings()
      fetchOpeningStockAndTotal()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to record restocking'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (restocking: Restocking) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    // Only allow editing today's restocking for staff, but allow past dates for admins
    if (userRole !== 'admin' && restocking.date !== today) {
      setMessage({ type: 'error', text: 'Can only edit restocking records for today. Past dates cannot be modified.' })
      return
    }
    setEditingRestocking(restocking)
    setSelectedItem(restocking.item_id)
    setQuantity(restocking.quantity.toString())
    setDate(restocking.date) // Use the restocking's date (allows past dates for admins)
    setNotes(restocking.notes || '')
  }

  const handleCancelEdit = () => {
    setEditingRestocking(null)
    setQuantity('')
    setNotes('')
    setSelectedItem('')
    setDate(format(new Date(), 'yyyy-MM-dd'))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this restocking record?')) return

    setLoading(true)
    const { error } = await supabase.from('restocking').delete().eq('id', id)
    if (error) {
      setMessage({ type: 'error', text: 'Failed to delete restocking' })
    } else {
      setMessage({ type: 'success', text: 'Restocking deleted successfully!' })
      fetchRestockings()
      fetchOpeningStockAndTotal()
    }
    setLoading(false)
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {editingRestocking ? 'Edit Restocking' : 'Restock Items'}
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Add quantity to items. This will be added to the opening stock for calculations.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {message && (
          <div
            className={`p-3 rounded ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
            Date {userRole !== 'admin' && <span className="text-xs text-gray-500">(Today only)</span>}
            {userRole === 'admin' && <span className="text-xs text-gray-500">(Admin: Can select past dates)</span>}
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => {
              const selectedDate = e.target.value
              const today = format(new Date(), 'yyyy-MM-dd')
              
              // Staff can only use today's date
              if (userRole !== 'admin' && selectedDate !== today) {
                setMessage({ type: 'error', text: 'Restocking can only be recorded for today\'s date.' })
                setDate(today)
                return
              }
              
              // Prevent future dates for everyone
              if (selectedDate > today) {
                setMessage({ type: 'error', text: 'Cannot record restocking for future dates.' })
                setDate(today)
                return
              }
              
              setDate(selectedDate)
              setMessage(null) // Clear any previous messages
            }}
            max={format(new Date(), 'yyyy-MM-dd')}
            required
            disabled={userRole !== 'admin'}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 ${
              userRole !== 'admin' ? 'bg-gray-50 cursor-not-allowed' : ''
            }`}
            readOnly={userRole !== 'admin'}
          />
          <p className="mt-1 text-xs text-gray-500">
            {userRole === 'admin' 
              ? 'Admins can record restocking for past dates to backfill data. Staff can only record for today.' 
              : 'Restocking can only be recorded for today to avoid confusion'}
          </p>
        </div>

        <div>
          <label htmlFor="item" className="block text-sm font-medium text-gray-700 mb-1">
            Item
          </label>
          <select
            id="item"
            value={selectedItem}
            onChange={(e) => setSelectedItem(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 cursor-pointer"
          >
            <option value="">Select an item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.unit})
              </option>
            ))}
          </select>
          {selectedItem && openingStock !== null && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
              <p>Opening Stock: <span className="font-medium">{openingStock}</span> {items.find(item => item.id === selectedItem)?.unit || ''}</p>
              {currentTotal !== null && (
                <p className="mt-1">Current Total (after restocks & sales): <span className="font-medium">{currentTotal.toFixed(2)}</span> {items.find(item => item.id === selectedItem)?.unit || ''}</p>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
            Quantity to Add
          </label>
          <input
            id="quantity"
            type="number"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            min="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
            placeholder="0.00"
          />
          <p className="mt-1 text-xs text-gray-500">Enter the quantity to add to the opening stock</p>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
            placeholder="Any additional notes..."
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {loading ? 'Saving...' : editingRestocking ? 'Update Restocking' : 'Record Restocking'}
          </button>
          {editingRestocking && (
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {restockings.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Restocking Records</h3>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity Added</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
                  {userRole === 'admin' && (
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {restockings.map((restocking) => (
                  <tr key={restocking.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(restocking.date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {restocking.item?.name || 'Unknown'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      +{restocking.quantity} {restocking.item?.unit || ''}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      {restocking.recorded_by_profile?.full_name || restocking.recorded_by_profile?.email || 'Unknown'}
                    </td>
                    {userRole === 'admin' && (
                      <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(restocking)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(restocking.id)}
                          className="text-red-600 hover:text-red-900 cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

