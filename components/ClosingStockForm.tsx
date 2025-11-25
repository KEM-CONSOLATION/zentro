'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Item, ClosingStock, Profile } from '@/types/database'
import { format } from 'date-fns'

export default function ClosingStockForm() {
  const [items, setItems] = useState<Item[]>([])
  const [stocks, setStocks] = useState<(ClosingStock & { item?: Item; recorded_by_profile?: Profile })[]>([])
  const [selectedItem, setSelectedItem] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingStock, setEditingStock] = useState<ClosingStock | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null)

  useEffect(() => {
    fetchItems()
    fetchStocks()
    checkUserRole()
  }, [])

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
    const { data, error } = await supabase.from('items').select('*').order('name')
    if (error) {
      // Error fetching items
    } else {
      setItems(data || [])
    }
  }

  const fetchStocks = async () => {
    const { data, error } = await supabase
      .from('closing_stock')
      .select(`
        *,
        item:items(*),
        recorded_by_profile:profiles(*)
      `)
      .order('date', { ascending: false })
      .limit(50)

    if (error) {
      // Error fetching stocks
    } else {
      setStocks(data || [])
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

      if (editingStock) {
        // Update existing stock
        const { error } = await supabase
          .from('closing_stock')
          .update({
            item_id: selectedItem,
            quantity: parseFloat(quantity),
            date,
            notes: notes || null,
          })
          .eq('id', editingStock.id)

        if (error) throw error
        setMessage({ type: 'success', text: 'Closing stock updated successfully!' })
        setEditingStock(null)
      } else {
        // Create or update stock
        const { error } = await supabase.from('closing_stock').upsert(
          {
            item_id: selectedItem,
            quantity: parseFloat(quantity),
            date,
            recorded_by: user.id,
            notes: notes || null,
          },
          {
            onConflict: 'item_id,date',
          }
        )

        if (error) throw error
        setMessage({ type: 'success', text: 'Closing stock recorded successfully!' })
      }

      setQuantity('')
      setNotes('')
      setSelectedItem('')
      setDate(format(new Date(), 'yyyy-MM-dd'))
      fetchStocks()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to record closing stock'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (stock: ClosingStock) => {
    setEditingStock(stock)
    setSelectedItem(stock.item_id)
    setQuantity(stock.quantity.toString())
    setDate(stock.date)
    setNotes(stock.notes || '')
  }

  const handleCancelEdit = () => {
    setEditingStock(null)
    setQuantity('')
    setNotes('')
    setSelectedItem('')
    setDate(format(new Date(), 'yyyy-MM-dd'))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this closing stock record?')) return

    setLoading(true)
    const { error } = await supabase.from('closing_stock').delete().eq('id', id)
    if (error) {
      setMessage({ type: 'error', text: 'Failed to delete closing stock' })
    } else {
      setMessage({ type: 'success', text: 'Closing stock deleted successfully!' })
      fetchStocks()
    }
    setLoading(false)
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {editingStock ? 'Edit Closing Stock' : 'Record Closing Stock'}
      </h2>
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
            Date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 cursor-pointer"
          />
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
        </div>

        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
            Quantity
          </label>
          <input
            id="quantity"
            type="number"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
            placeholder="0.00"
          />
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
            {loading ? 'Saving...' : editingStock ? 'Update Stock' : 'Record Closing Stock'}
          </button>
          {editingStock && (
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

      {stocks.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Closing Stock Records</h3>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  {userRole === 'admin' && (
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stocks.map((stock) => (
                  <tr key={stock.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(stock.date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {stock.item?.name || 'Unknown'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {stock.quantity} {stock.item?.unit || ''}
                    </td>
                    {userRole === 'admin' && (
                      <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(stock)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(stock.id)}
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

