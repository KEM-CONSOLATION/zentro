'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Item, Sale, Profile } from '@/types/database'
import { format } from 'date-fns'

export default function SalesForm() {
  const [items, setItems] = useState<Item[]>([])
  const [sales, setSales] = useState<(Sale & { item?: Item; recorded_by_profile?: Profile })[]>([])
  const [selectedItem, setSelectedItem] = useState('')
  const [quantity, setQuantity] = useState('')
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [totalPrice, setTotalPrice] = useState('')
  const [paymentMode, setPaymentMode] = useState<'cash' | 'transfer'>('cash')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null)

  useEffect(() => {
    fetchItems()
    fetchSales()
    checkUserRole()
  }, [])

  // Calculate price when item or quantity changes
  useEffect(() => {
    if (selectedItem && quantity) {
      const selectedItemData = items.find(item => item.id === selectedItem)
      if (selectedItemData && selectedItemData.selling_price > 0) {
        const qty = parseFloat(quantity) || 0
        const price = selectedItemData.selling_price
        setPricePerUnit(price.toString())
        setTotalPrice((qty * price).toFixed(2))
      }
    }
  }, [selectedItem, quantity, items])

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

  const fetchSales = async () => {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        item:items(*),
        recorded_by_profile:profiles(*)
      `)
      .order('date', { ascending: false })
      .limit(50)

    if (error) {
      // Error fetching sales
    } else {
      setSales(data || [])
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

      // Restrict staff to only record sales for today
      const today = format(new Date(), 'yyyy-MM-dd')
      if (userRole === 'staff' && date !== today) {
        setMessage({ 
          type: 'error', 
          text: 'Staff can only record sales for today. Please select today\'s date.' 
        })
        setLoading(false)
        return
      }

      // Validate quantity doesn't exceed opening stock minus sales already made
      if (selectedItem) {
        const quantityValue = parseFloat(quantity)
        
        // Get opening stock for the date
        const { data: openingStock } = await supabase
          .from('opening_stock')
          .select('quantity')
          .eq('item_id', selectedItem)
          .eq('date', date)
          .single()

        // Get total sales for the date so far (excluding current sale if editing)
        const { data: existingSales } = await supabase
          .from('sales')
          .select('id, quantity')
          .eq('item_id', selectedItem)
          .eq('date', date)

        const totalSalesSoFar = existingSales?.reduce((sum, s) => {
          // Exclude the sale being edited
          if (editingSale && s.id === editingSale.id) return sum
          return sum + parseFloat(s.quantity.toString())
        }, 0) || 0
        
        const openingQty = openingStock?.quantity || 0
        const availableStock = openingQty - totalSalesSoFar
        
        if (quantityValue > availableStock) {
          setMessage({ 
            type: 'error', 
            text: `Cannot record sales of ${quantityValue}. Available stock: ${availableStock}` 
          })
          setLoading(false)
          return
        }
      }

      if (editingSale) {
        // Update existing sale via API
        const response = await fetch('/api/sales/update', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sale_id: editingSale.id,
              item_id: selectedItem,
              quantity: parseFloat(quantity),
              price_per_unit: parseFloat(pricePerUnit) || 0,
              total_price: parseFloat(totalPrice) || 0,
              payment_mode: paymentMode,
              date,
              description: description || null,
              old_quantity: editingSale.quantity,
            }),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update sales')
        }

        setMessage({ type: 'success', text: 'Sales record updated successfully!' })
        setEditingSale(null)
      } else {
        // Create new sale via API
        const response = await fetch('/api/sales/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              item_id: selectedItem,
              quantity: parseFloat(quantity),
              price_per_unit: parseFloat(pricePerUnit) || 0,
              total_price: parseFloat(totalPrice) || 0,
              payment_mode: paymentMode,
              date,
              description: description || null,
              user_id: user.id,
            }),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to record sales')
        }

        setMessage({ type: 'success', text: 'Sales recorded successfully!' })
      }

      setQuantity('')
      setPricePerUnit('')
      setTotalPrice('')
      setPaymentMode('cash')
      setDescription('')
      setSelectedItem('')
      setDate(format(new Date(), 'yyyy-MM-dd'))
      await fetchSales()
      await fetchItems() // Refresh items to show updated quantities
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to record sales'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (sale: Sale) => {
    setEditingSale(sale)
    setSelectedItem(sale.item_id)
    setQuantity(sale.quantity.toString())
    setPricePerUnit(sale.price_per_unit.toString())
    setTotalPrice(sale.total_price.toString())
    setPaymentMode(sale.payment_mode)
    setDate(sale.date)
    setDescription(sale.description || '')
  }

  const handleCancelEdit = () => {
    setEditingSale(null)
    setQuantity('')
    setPricePerUnit('')
    setTotalPrice('')
    setPaymentMode('cash')
    setDescription('')
    setSelectedItem('')
    setDate(format(new Date(), 'yyyy-MM-dd'))
  }

  // Calculate total price when price per unit or quantity changes manually
  const handlePricePerUnitChange = (value: string) => {
    setPricePerUnit(value)
    const qty = parseFloat(quantity) || 0
    const price = parseFloat(value) || 0
    setTotalPrice((qty * price).toFixed(2))
  }

  const handleQuantityChange = (value: string) => {
    setQuantity(value)
    const qty = parseFloat(value) || 0
    const price = parseFloat(pricePerUnit) || 0
    if (price > 0) {
      setTotalPrice((qty * price).toFixed(2))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sales record? This will restore the item quantity.')) return

    setLoading(true)
    try {
      const saleToDelete = sales.find(s => s.id === id)
      if (!saleToDelete) {
        setMessage({ type: 'error', text: 'Sales record not found' })
        setLoading(false)
        return
      }

      const response = await fetch(`/api/sales/delete?sale_id=${id}&item_id=${saleToDelete.item_id}&quantity=${saleToDelete.quantity}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete sales record')
      }

      setMessage({ type: 'success', text: 'Sales record deleted successfully! Item quantity restored.' })
      fetchSales()
      fetchItems() // Refresh items to show updated quantities
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete sales record'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {editingSale ? 'Edit Sales/Usage' : 'Record Sales/Usage'}
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
            disabled={userRole === 'staff'}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 cursor-pointer ${
              userRole === 'staff' ? 'bg-gray-100 cursor-not-allowed' : ''
            }`}
          />
          {userRole === 'staff' && (
            <p className="mt-1 text-xs text-gray-500">Staff can only record sales for today</p>
          )}
        </div>

        <div>
          <label htmlFor="item" className="block text-sm font-medium text-gray-700 mb-1">
            Item Used
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
            Quantity Used
            {selectedItem && (
              <span className="ml-2 text-xs text-gray-500">
                (Max: {items.find(item => item.id === selectedItem)?.quantity || 0} {items.find(item => item.id === selectedItem)?.unit || ''})
              </span>
            )}
          </label>
          <input
            id="quantity"
            type="number"
            step="1"
            value={quantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
            required
            min="0"
            max={selectedItem ? items.find(item => item.id === selectedItem)?.quantity : undefined}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
            placeholder="0"
          />
          {selectedItem && (() => {
            const item = items.find(item => item.id === selectedItem)
            return item && item.selling_price > 0 ? (
              <p className="mt-1 text-xs text-gray-500">
                Selling price: ₦{item.selling_price.toFixed(2)}/{item.unit}
              </p>
            ) : null
          })()}
        </div>

        <div>
          <label htmlFor="price_per_unit" className="block text-sm font-medium text-gray-700 mb-1">
            Price Per Unit (₦)
          </label>
          <input
            id="price_per_unit"
            type="number"
            step="0.01"
            min="0"
            value={pricePerUnit}
            onChange={(e) => handlePricePerUnitChange(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
            placeholder="0.00"
          />
          {selectedItem && (() => {
            const item = items.find(item => item.id === selectedItem)
            return item && item.selling_price > 0 ? (
              <p className="mt-1 text-xs text-gray-500">
                Default: ₦{item.selling_price.toFixed(2)}/{item.unit}
              </p>
            ) : null
          })()}
        </div>

        <div>
          <label htmlFor="total_price" className="block text-sm font-medium text-gray-700 mb-1">
            Total Price (₦)
          </label>
          <input
            id="total_price"
            type="number"
            step="0.01"
            min="0"
            value={totalPrice}
            onChange={(e) => setTotalPrice(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black bg-gray-50"
            placeholder="0.00"
          />
          <p className="mt-1 text-xs text-gray-500">Calculated automatically, but can be edited if needed</p>
        </div>

        <div>
          <label htmlFor="payment_mode" className="block text-sm font-medium text-gray-700 mb-1">
            Payment Mode
          </label>
          <select
            id="payment_mode"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as 'cash' | 'transfer')}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 cursor-pointer"
          >
            <option value="cash">Cash</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description (e.g., Rice, Egusi & Fufu)
          </label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
            placeholder="Rice, Egusi & Fufu"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {loading ? 'Saving...' : editingSale ? 'Update Sales' : 'Record Sales'}
          </button>
          {editingSale && (
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

      {sales.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Sales/Usage Records</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price/Unit</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Price</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Mode</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  {userRole === 'admin' && (
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(sale.date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {sale.item?.name || 'Unknown'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      {sale.quantity} {sale.item?.unit || ''}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      ₦{sale.price_per_unit.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                      ₦{sale.total_price.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        sale.payment_mode === 'cash' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {sale.payment_mode === 'cash' ? 'Cash' : 'Transfer'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {sale.description || '-'}
                    </td>
                    {userRole === 'admin' && (
                      <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(sale)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(sale.id)}
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

