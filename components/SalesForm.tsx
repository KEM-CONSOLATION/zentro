'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Item, Sale, Profile, ClosingStock, OpeningStock } from '@/types/database'
import { format } from 'date-fns'

// Component to display stock availability and closing stock for a specific date
function StockAvailabilityDisplay({ 
  itemId, 
  date, 
  sales, 
  editingSale, 
  item,
  quantityToRecord
}: { 
  itemId: string
  date: string
  sales: (Sale & { item?: Item })[]
  editingSale: Sale | null
  item: Item
  quantityToRecord?: number
}) {
  const [availableStock, setAvailableStock] = useState<number | null>(null)
  const [closingStock, setClosingStock] = useState<number | null>(null)
  const [stockInfo, setStockInfo] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const salesRef = useRef(sales)
  const editingSaleRef = useRef(editingSale)
  const today = format(new Date(), 'yyyy-MM-dd')
  const isPastDate = date < today

  // Update refs when props change
  useEffect(() => {
    salesRef.current = sales
    editingSaleRef.current = editingSale
  }, [sales, editingSale])

  useEffect(() => {
    // Only calculate if we have an item ID and date
    if (!itemId || !date) {
      setLoading(false)
      return
    }

    let isMounted = true

    const calculateAvailability = async () => {
      setLoading(true)
      try {
        // Get current sales for this item and date
        const itemSales = salesRef.current.filter(s => s.item_id === itemId && s.date === date)
        const totalSales = itemSales.reduce((sum, s) => {
          if (editingSaleRef.current && s.id === editingSaleRef.current.id) return sum
          return sum + s.quantity
        }, 0)

        // Add the quantity being recorded (if any) to total sales for closing stock calculation
        const salesIncludingNew = totalSales + (quantityToRecord || 0)

        if (isPastDate) {
          // For past dates: Opening Stock + Restocking - Sales - Waste/Spoilage
          const { data: openingStock } = await supabase
            .from('opening_stock')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', date)
            .single()

          const { data: restocking } = await supabase
            .from('restocking')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', date)

          const { data: wasteSpoilage } = await supabase
            .from('waste_spoilage')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', date)

          const openingQty = openingStock ? parseFloat(openingStock.quantity.toString()) : 0
          const totalRestocking = restocking?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0
          const totalWasteSpoilage = wasteSpoilage?.reduce((sum, ws) => sum + parseFloat(ws.quantity.toString()), 0) || 0

          // Available stock before this sale
          const available = openingQty + totalRestocking - totalSales
          // Closing stock after this sale
          const closing = openingQty + totalRestocking - salesIncludingNew - totalWasteSpoilage

          if (isMounted) {
            setAvailableStock(available)
            setClosingStock(closing)
            setStockInfo(`Opening: ${openingQty}, Restocked: ${totalRestocking}, Sold: ${totalSales}, Waste/Spoilage: ${totalWasteSpoilage}`)
          }
        } else {
          // For today: Current quantity - Sales
          const available = item.quantity - totalSales
          // Closing stock would be: Current quantity - Sales (including new) - Waste/Spoilage
          const { data: wasteSpoilage } = await supabase
            .from('waste_spoilage')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', date)

          const totalWasteSpoilage = wasteSpoilage?.reduce((sum, ws) => sum + parseFloat(ws.quantity.toString()), 0) || 0
          const closing = item.quantity - salesIncludingNew - totalWasteSpoilage

          if (isMounted) {
            setAvailableStock(available)
            setClosingStock(closing)
            setStockInfo(`Current: ${item.quantity}, Sold today: ${totalSales}, Waste/Spoilage: ${totalWasteSpoilage}`)
          }
        }
      } catch {
        if (isMounted) {
          setAvailableStock(null)
          setClosingStock(null)
          setStockInfo('Unable to calculate')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    calculateAvailability()

    return () => {
      isMounted = false
    }
  }, [itemId, date, quantityToRecord, isPastDate, item.quantity])

  if (loading) {
    return <p className="text-xs text-gray-500">Calculating availability...</p>
  }

  return (
    <div className="space-y-1">
      <p className={`text-xs ${availableStock !== null && availableStock > 0 ? 'text-gray-500' : 'text-red-600'}`}>
        Available stock: {availableStock !== null && availableStock > 0 ? availableStock : 0} {item.unit}
      </p>
      {closingStock !== null && (
        <p className="text-xs text-blue-600 font-medium">
          Closing stock after this sale: {closingStock > 0 ? closingStock : 0} {item.unit}
        </p>
      )}
      <p className="text-xs text-gray-400">
        ({stockInfo})
      </p>
    </div>
  )
}

export default function SalesForm() {
  const [items, setItems] = useState<Item[]>([])
  const [sales, setSales] = useState<(Sale & { item?: Item; recorded_by_profile?: Profile })[]>([])
  const [closingStocks, setClosingStocks] = useState<(ClosingStock & { item?: Item })[]>([])
  const [openingStocks, setOpeningStocks] = useState<(OpeningStock & { item?: Item })[]>([])
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
  const today = format(new Date(), 'yyyy-MM-dd')
  const isPastDate = date < today

  useEffect(() => {
    fetchItems()
    fetchSales()
    checkUserRole()
    // Fetch closing stock and opening stock for past dates
    if (isPastDate) {
      fetchClosingStock()
      fetchOpeningStock()
    } else {
      setClosingStocks([])
      setOpeningStocks([])
    }
    // Ensure date is always today for staff, but allow past dates for admins
    if (userRole === 'staff' && date !== today) {
      setDate(today)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, userRole, isPastDate])

  // Calculate price when item or quantity changes
  useEffect(() => {
    if (selectedItem && quantity) {
      let price = 0
      
      if (isPastDate) {
        // For past dates: use selling price from opening stock of that date
        const openingStock = openingStocks.find(os => os.item_id === selectedItem)
        if (openingStock && openingStock.selling_price) {
          price = openingStock.selling_price
        } else {
          // Fallback to item's current selling price
          const selectedItemData = items.find(item => item.id === selectedItem)
          price = selectedItemData?.selling_price || 0
        }
      } else {
        // For today: use item's current selling price
        const selectedItemData = items.find(item => item.id === selectedItem)
        price = selectedItemData?.selling_price || 0
      }
      
      if (price > 0) {
        const qty = parseFloat(quantity) || 0
        setPricePerUnit(price.toString())
        setTotalPrice((qty * price).toFixed(2))
      }
    }
  }, [selectedItem, quantity, items, isPastDate, openingStocks])

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
    try {
      const { data, error } = await supabase.from('items').select('*').order('name')
      if (error) {
        setMessage({ type: 'error', text: 'Failed to fetch items. Please refresh the page.' })
      } else {
        setItems(data || [])
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to fetch items. Please refresh the page.' })
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
      .eq('date', date)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setSales(data)
    }
  }

  const fetchClosingStock = async () => {
    try {
      const { data, error } = await supabase
        .from('closing_stock')
        .select(`
          *,
          item:items(*)
        `)
        .eq('date', date)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setClosingStocks(data as (ClosingStock & { item?: Item })[])
      }
    } catch {
      // Silently fail - closing stock might not exist for all dates
      setClosingStocks([])
    }
  }

  const fetchOpeningStock = async () => {
    try {
      const { data, error } = await supabase
        .from('opening_stock')
        .select(`
          *,
          item:items(*)
        `)
        .eq('date', date)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setOpeningStocks(data as (OpeningStock & { item?: Item })[])
      }
    } catch {
      // Silently fail - opening stock might not exist for all dates
      setOpeningStocks([])
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

      // Restrict sales to today only for staff, allow past dates for admins
      const today = format(new Date(), 'yyyy-MM-dd')
      if (userRole !== 'admin' && date !== today) {
        setMessage({ 
          type: 'error', 
          text: 'Sales can only be recorded for today\'s date. Please use today\'s date.' 
        })
        setDate(today) // Reset to today
        setLoading(false)
        return
      }
      
      // Prevent future dates for everyone
      if (date > today) {
        setMessage({ 
          type: 'error', 
          text: 'Cannot record sales for future dates.' 
        })
        setDate(today)
        setLoading(false)
        return
      }

      if (selectedItem) {
        const quantityValue = parseFloat(quantity)
        
        if (isNaN(quantityValue) || quantityValue <= 0) {
          setMessage({ 
            type: 'error', 
            text: 'Please enter a valid quantity greater than 0' 
          })
          setLoading(false)
          return
        }

        const { data: freshItem, error: itemError } = await supabase
          .from('items')
          .select('quantity, name, unit')
          .eq('id', selectedItem)
          .single()

        if (itemError || !freshItem) {
          setMessage({ 
            type: 'error', 
            text: 'Item not found. Please refresh and try again.' 
          })
          setLoading(false)
          return
        }

        const today = format(new Date(), 'yyyy-MM-dd')
        const isPastDate = date < today
        
        // Calculate available stock based on the selected date
        let availableStock = 0
        let stockInfo = ''
        
        if (isPastDate) {
          // For past dates: Opening Stock + Restocking - Sales already recorded
          const { data: openingStock } = await supabase
            .from('opening_stock')
            .select('quantity')
            .eq('item_id', selectedItem)
            .eq('date', date)
            .single()

          const { data: restocking } = await supabase
            .from('restocking')
            .select('quantity')
            .eq('item_id', selectedItem)
            .eq('date', date)

          const { data: existingSales } = await supabase
            .from('sales')
            .select('id, quantity')
            .eq('item_id', selectedItem)
            .eq('date', date)

          const openingQty = openingStock ? parseFloat(openingStock.quantity.toString()) : 0
          const totalRestocking = restocking?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0
          const totalSalesSoFar = existingSales?.reduce((sum, s) => {
            if (editingSale && s.id === editingSale.id) return sum
            return sum + parseFloat(s.quantity.toString())
          }, 0) || 0

          availableStock = openingQty + totalRestocking - totalSalesSoFar
          stockInfo = `Opening: ${openingQty}, Restocked: ${totalRestocking}, Sold: ${totalSalesSoFar}`
        } else {
          // For today: Current quantity - Sales already made today
          const { data: existingSales } = await supabase
            .from('sales')
            .select('id, quantity')
            .eq('item_id', selectedItem)
            .eq('date', date)

          const totalSalesSoFar = existingSales?.reduce((sum, s) => {
            if (editingSale && s.id === editingSale.id) return sum
            return sum + parseFloat(s.quantity.toString())
          }, 0) || 0
          
          availableStock = freshItem.quantity - totalSalesSoFar
          stockInfo = `Current: ${freshItem.quantity}, Sold today: ${totalSalesSoFar}`
        }
        
        if (availableStock <= 0) {
          setMessage({ 
            type: 'error', 
            text: `No available stock for ${date}. ${stockInfo}` 
          })
          setLoading(false)
          return
        }

        if (quantityValue > availableStock) {
          setMessage({ 
            type: 'error', 
            text: `Cannot record sales of ${quantityValue}. Available stock: ${availableStock} (${stockInfo})` 
          })
          setLoading(false)
          return
        }
      }

        if (editingSale) {
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
      await fetchItems()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to record sales'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (sale: Sale) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    // Only allow editing if it's today's sale
    if (sale.date !== today) {
      setMessage({ type: 'error', text: 'Can only edit sales records for today. Past dates cannot be modified.' })
      return
    }
    setEditingSale(sale)
    setSelectedItem(sale.item_id)
    setQuantity(sale.quantity.toString())
    setPricePerUnit(sale.price_per_unit.toString())
    setTotalPrice(sale.total_price.toString())
    setPaymentMode(sale.payment_mode)
    setDate(today) // Always use today's date
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
      fetchItems()
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
                setMessage({ type: 'error', text: 'Sales can only be recorded for today\'s date.' })
                setDate(today)
                return
              }
              
              // Prevent future dates for everyone
              if (selectedDate > today) {
                setMessage({ type: 'error', text: 'Cannot record sales for future dates.' })
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
              ? 'Admins can record sales for past dates to backfill data. Staff can only record for today.' 
              : 'Sales can only be recorded for today to avoid confusion'}
          </p>
        </div>

        <div>
          <label htmlFor="item" className="block text-sm font-medium text-gray-700 mb-1">
            Item Used
            {isPastDate && <span className="text-xs text-gray-500 ml-1">(From closing stock)</span>}
          </label>
          <select
            id="item"
            value={selectedItem}
            onChange={(e) => setSelectedItem(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 cursor-pointer"
          >
            <option value="">Select an item</option>
            {isPastDate ? (
              // For past dates: show items from closing stock
              closingStocks.map((closingStock) => {
                const item = closingStock.item
                if (!item) return null
                
                const itemSales = sales.filter(s => s.item_id === item.id)
                const totalSales = itemSales.reduce((sum, s) => {
                  // Exclude the sale being edited from total
                  if (editingSale && s.id === editingSale.id) return sum
                  return sum + s.quantity
                }, 0)
                
                // Available = Closing stock quantity - Sales already made for that date
                const closingQty = parseFloat(closingStock.quantity.toString())
                const available = closingQty - totalSales
                
                return (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit}) - Available: {available > 0 ? available : 0} (from closing stock: {closingQty})
                  </option>
                )
              })
            ) : (
              // For today: show all items with current quantity
              items.map((item) => {
                const itemSales = sales.filter(s => s.item_id === item.id)
                const totalSales = itemSales.reduce((sum, s) => {
                  // Exclude the sale being edited from total
                  if (editingSale && s.id === editingSale.id) return sum
                  return sum + s.quantity
                }, 0)
                // Available = Current quantity - Sales already made today
                const available = item.quantity - totalSales
                
                return (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit}) - Available: {available > 0 ? available : 0}
                  </option>
                )
              })
            )}
          </select>
          {isPastDate && closingStocks.length === 0 && (
            <p className="mt-1 text-xs text-red-500">
              No closing stock found for this date. Please record closing stock first.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
            Quantity Used
          </label>
          <input
            id="quantity"
            type="number"
            step="1"
            value={quantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
            required
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
            placeholder="0"
          />
          {selectedItem && (() => {
            const item = items.find(item => item.id === selectedItem)
            if (!item) return null
            
            return (
              <div className="mt-1 space-y-1">
                {item.selling_price > 0 && (
                  <p className="text-xs text-gray-500">
                    Selling price: ₦{item.selling_price.toFixed(2)}/{item.unit}
                  </p>
                )}
                <StockAvailabilityDisplay 
                  itemId={selectedItem}
                  date={date}
                  sales={sales}
                  editingSale={editingSale}
                  item={item}
                  quantityToRecord={parseFloat(quantity) || 0}
                />
              </div>
            )
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
          <div className="overflow-x-auto -mx-6 px-6">
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

