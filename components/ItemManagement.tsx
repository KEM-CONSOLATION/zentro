'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Item } from '@/types/database'

export default function ItemManagement() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    unit: 'pieces',
    quantity: '',
    low_stock_threshold: '10',
    cost_price: '',
    selling_price: '',
    description: '',
  })
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchItems()
  }, [])

  const capitalizeItemName = (name: string): string => {
    return name
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const fetchItems = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('items').select('*').order('name')
    if (error) {
      setMessage({ type: 'error', text: 'Failed to fetch items' })
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      // Capitalize item name before saving
      const capitalizedName = capitalizeItemName(formData.name.trim())

      if (editingItem) {
        const { error } = await supabase
          .from('items')
          .update({
            name: capitalizedName,
            unit: formData.unit,
            // Don't update quantity when editing - it's managed through opening stock and restocking
            // Don't update prices when editing - they're managed through opening stock and restocking
            low_stock_threshold: parseInt(formData.low_stock_threshold, 10) || 10,
            description: formData.description || null,
          })
          .eq('id', editingItem.id)

        if (error) throw error
        setMessage({ type: 'success', text: 'Item updated successfully!' })
      } else {
        // Get user's organization_id to ensure proper assignment
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single()

        const itemData: {
          name: string
          unit: string
          quantity: number
          low_stock_threshold: number
          cost_price: number
          selling_price: number
          description: string | null
          organization_id?: string | null
        } = {
          name: capitalizedName,
          unit: formData.unit,
          quantity: parseInt(formData.quantity, 10) || 0,
          low_stock_threshold: parseInt(formData.low_stock_threshold, 10) || 10,
          cost_price: parseFloat(formData.cost_price) || 0,
          selling_price: parseFloat(formData.selling_price) || 0,
          description: formData.description || null,
        }

        if (profile?.organization_id) {
          itemData.organization_id = profile.organization_id
        }

        const { error } = await supabase.from('items').insert(itemData)

        if (error) throw error
        setMessage({ 
          type: 'success', 
          text: 'Item created successfully! Remember to restock it to make it available for sales.' 
        })
      }

      setFormData({ name: '', unit: 'pieces', quantity: '', low_stock_threshold: '10', cost_price: '', selling_price: '', description: '' })
      setEditingItem(null)
      setShowForm(false)
      fetchItems()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save item'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (item: Item) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      unit: item.unit,
      quantity: '', // Don't show quantity when editing
      low_stock_threshold: (item.low_stock_threshold || 10).toString(),
      cost_price: '', // Don't show prices when editing - they're managed through opening stock and restocking
      selling_price: '', // Don't show prices when editing - they're managed through opening stock and restocking
      description: item.description || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    // Check if item has any sales records
    const { data: salesData } = await supabase
      .from('sales')
      .select('id')
      .eq('item_id', id)
      .limit(1)

    const { data: openingStockData } = await supabase
      .from('opening_stock')
      .select('id')
      .eq('item_id', id)
      .limit(1)

    const { data: closingStockData } = await supabase
      .from('closing_stock')
      .select('id')
      .eq('item_id', id)
      .limit(1)

    const hasRecords = (salesData && salesData.length > 0) || 
                      (openingStockData && openingStockData.length > 0) || 
                      (closingStockData && closingStockData.length > 0)

    if (hasRecords) {
      setMessage({ 
        type: 'error', 
        text: 'Cannot delete item: This item has sales, opening stock, or closing stock records. To preserve audit history, items with transaction records cannot be deleted.' 
      })
      return
    }

    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) return

    setLoading(true)
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) {
      if (error.code === '23503') {
        setMessage({ 
          type: 'error', 
          text: 'Cannot delete item: This item has related records (sales, opening stock, or closing stock). To preserve audit history, items with transaction records cannot be deleted.' 
        })
      } else {
        setMessage({ type: 'error', text: `Failed to delete item: ${error.message}` })
      }
    } else {
      setMessage({ type: 'success', text: 'Item deleted successfully!' })
      fetchItems()
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Manage Items</h2>
        <button
          onClick={() => {
            setShowForm(!showForm)
            setEditingItem(null)
            setFormData({ name: '', unit: 'pieces', quantity: '', low_stock_threshold: '10', cost_price: '', selling_price: '', description: '' })
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 cursor-pointer transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add New Item'}
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingItem ? 'Edit Item' : 'Add New Item'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Item Name
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                placeholder="e.g., Rice, Egusi, Fufu"
              />
            </div>

            <div>
              <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-1">
                Unit
              </label>
              <select
                id="unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 cursor-pointer"
              >
                <option value="pieces">Pieces</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="g">Grams (g)</option>
                <option value="liters">Liters</option>
                <option value="ml">Milliliters (ml)</option>
                <option value="bags">Bags</option>
                <option value="packets">Packets</option>
                <option value="boxes">Boxes</option>
              </select>
            </div>

            <div>
              <label htmlFor="low_stock_threshold" className="block text-sm font-medium text-gray-700 mb-1">
                Low Stock Threshold *
              </label>
              <input
                id="low_stock_threshold"
                type="number"
                step="1"
                min="0"
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                placeholder="10"
              />
              <p className="mt-1 text-xs text-gray-500">Alert when quantity falls below this</p>
            </div>
            {!editingItem && (
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                  Initial Quantity * (for new items only)
                </label>
                <input
                  id="quantity"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                  placeholder="0"
                />
                <p className="mt-1 text-xs text-gray-500">
                  <strong>Note:</strong> This is only used as an initial value. Actual stock quantities are managed through 
                  <strong> Opening Stock</strong> and <strong>Restocking</strong> features. The quantity field is not displayed 
                  in the items table to avoid confusion with the opening/closing stock system.
                </p>
              </div>
            )}
            {editingItem && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Item quantities and prices are managed through <strong>Opening Stock</strong> and <strong>Restocking</strong> features. 
                  To add stock or update prices, use the Restocking section instead of editing the item directly.
                </p>
              </div>
            )}

            {!editingItem && (
              <>
                <div>
                  <label htmlFor="cost_price" className="block text-sm font-medium text-gray-700 mb-1">
                    Default Cost Price (₦) <span className="text-xs text-gray-500 font-normal">(Optional - for initial setup only)</span>
                  </label>
                  <input
                    id="cost_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                    placeholder="0.00"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    <strong>Note:</strong> Prices are managed through <strong>Opening Stock</strong> and <strong>Restocking</strong> features. 
                    This is only used as a default value for new items. Actual prices are tracked per day in the stock system.
                  </p>
                </div>

                <div>
                  <label htmlFor="selling_price" className="block text-sm font-medium text-gray-700 mb-1">
                    Default Selling Price (₦) <span className="text-xs text-gray-500 font-normal">(Optional - for initial setup only)</span>
                  </label>
                  <input
                    id="selling_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                    placeholder="0.00"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    <strong>Note:</strong> Prices are managed through <strong>Opening Stock</strong> and <strong>Restocking</strong> features. 
                    This is only used as a default value for new items. Actual prices are tracked per day in the stock system.
                  </p>
                </div>
              </>
            )}

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                placeholder="Additional details about this item..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {loading ? 'Saving...' : editingItem ? 'Update Item' : 'Create Item'}
            </button>
          </form>
        </div>
      )}

      {loading && !showForm ? (
        <div className="text-center py-8">Loading items...</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Threshold
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No items found. Add your first item to get started.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unit}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.description || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-900 cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

