'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Item, Sale, Profile, OpeningStock, Restocking } from '@/types/database'
import { format } from 'date-fns'

// Helper function to normalize date format
const normalizeDateStr = (dateStr: string): string => {
  if (!dateStr) return ''
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0]
  } else if (dateStr.includes('/')) {
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      // DD/MM/YYYY to YYYY-MM-DD
      return `${parts[2]}-${parts[1]}-${parts[0]}`
    }
  }
  return dateStr
}

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

  useEffect(() => {
    salesRef.current = sales
    editingSaleRef.current = editingSale
  }, [sales, editingSale])

  useEffect(() => {
    if (!itemId || !date) {
      setLoading(false)
      return
    }

    let isMounted = true

    const calculateAvailability = async () => {
      setLoading(true)
      try {
        const normalizedDate = normalizeDateStr(date)
        const itemSales = salesRef.current.filter(s => {
          const saleDate = normalizeDateStr(s.date)
          return s.item_id === itemId && saleDate === normalizedDate
        })
        const totalSales = itemSales.reduce((sum, s) => {
          if (editingSaleRef.current && s.id === editingSaleRef.current.id) return sum
          return sum + parseFloat(s.quantity.toString())
        }, 0)

        const salesIncludingNew = totalSales + (quantityToRecord || 0)
        
        if (isPastDate) {
          const { data: openingStockData } = await supabase
            .from('opening_stock')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)
            .limit(1)

          const { data: restocking } = await supabase
            .from('restocking')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)

          const { data: wasteSpoilage } = await supabase
            .from('waste_spoilage')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)

          const openingStock = openingStockData && openingStockData.length > 0 ? openingStockData[0] : null
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
          const { data: openingStockData } = await supabase
            .from('opening_stock')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)
            .limit(1)

          const { data: restocking } = await supabase
            .from('restocking')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)

          const { data: wasteSpoilage } = await supabase
            .from('waste_spoilage')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)

          const openingStock = openingStockData && openingStockData.length > 0 ? openingStockData[0] : null
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
            setStockInfo(`Opening: ${openingQty}, Restocked: ${totalRestocking}, Sold today: ${totalSales}, Waste/Spoilage: ${totalWasteSpoilage}`)
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
  }, [itemId, date, quantityToRecord, isPastDate])

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
  const [openingStocks, setOpeningStocks] = useState<(OpeningStock & { item?: Item })[]>([])
  const [restockings, setRestockings] = useState<(Restocking & { item?: Item })[]>([])
  const [selectedItem, setSelectedItem] = useState('')
  const [selectedBatch, setSelectedBatch] = useState<{ type: 'opening_stock' | 'restocking'; id: string; price: number; label: string; available: number } | null>(null)
  const [quantity, setQuantity] = useState('')
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [totalPrice, setTotalPrice] = useState('')
  const [paymentMode, setPaymentMode] = useState<'cash' | 'transfer'>('cash')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'staff' | 'superadmin' | null>(null)
  const today = format(new Date(), 'yyyy-MM-dd')
  const isPastDate = date < today

  // Helper function to normalize date format
  const normalizeDate = useCallback((dateStr: string): string => {
    if (!dateStr) return ''
    if (dateStr.includes('T')) {
      return dateStr.split('T')[0]
    } else if (dateStr.includes('/')) {
      const parts = dateStr.split('/')
      if (parts.length === 3) {
        // DD/MM/YYYY to YYYY-MM-DD
        return `${parts[2]}-${parts[1]}-${parts[0]}`
      }
    }
    return dateStr
  }, [])

  // Wrap fetch functions in useCallback to memoize them
  const fetchSalesCallback = useCallback(async () => {
    const dateStr = normalizeDate(date)
    
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      console.error('Invalid date format:', date)
      setSales([])
      return
    }
    
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        item:items(*),
        recorded_by_profile:profiles(*),
        restocking:restocking(*),
        opening_stock:opening_stock(*)
      `)
      .eq('date', dateStr)
      .order('created_at', { ascending: false })

    if (error) {
      setSales([])
    } else {
      setSales(data || [])
    }
  }, [date, normalizeDate])

  const fetchOpeningStockCallback = useCallback(async () => {
    try {
      let dateStr = date
      
      if (date.includes('T')) {
        dateStr = date.split('T')[0]
      } else if (date.includes('/')) {
        const parts = date.split('/')
        if (parts.length === 3) {
          dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`
        }
      }
      
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        setMessage({ 
          type: 'error', 
          text: `Invalid date format: ${date}. Please select a valid date.` 
        })
        setOpeningStocks([])
        return
      }
      
      const { data, error } = await supabase
        .from('opening_stock')
        .select(`
          *,
          item:items(*)
        `)
        .eq('date', dateStr)
        .order('created_at', { ascending: false })

      if (error) {
        setMessage({ 
          type: 'error', 
          text: `Error fetching opening stock: ${error.message}` 
        })
        setOpeningStocks([])
        return
      }

      if (data && data.length > 0) {
        const uniqueOpeningStocks = data.reduce((acc, current) => {
          const existing = acc.find((item: typeof data[0]) => item.item_id === current.item_id)
          if (!existing) {
            acc.push(current)
          } else {
            const currentDateMatch = current.date === dateStr
            const existingDateMatch = existing.date === dateStr
            
            if (currentDateMatch && !existingDateMatch) {
              const index = acc.indexOf(existing)
              acc[index] = current
            } else if (!currentDateMatch && existingDateMatch) {
              // Keep existing
            } else {
              if (new Date(current.created_at) > new Date(existing.created_at)) {
                const index = acc.indexOf(existing)
                acc[index] = current
              }
            }
          }
          return acc
        }, [] as typeof data)
        
        setOpeningStocks(uniqueOpeningStocks as (OpeningStock & { item?: Item })[])
        if (message?.type === 'error' && message.text.includes('opening stock')) {
          setMessage(null)
        }
      } else {
        setOpeningStocks([])
        if (isPastDate) {
          setMessage({ 
            type: 'error', 
            text: `No opening stock found for ${dateStr}. Please record opening stock first for this date.` 
          })
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setMessage({ 
        type: 'error', 
        text: `Failed to fetch opening stock: ${errorMessage}. Please try again.` 
      })
      setOpeningStocks([])
    }
  }, [date, isPastDate, message])

  const fetchRestockingCallback = useCallback(async () => {
    try {
      let dateStr = date
      if (date.includes('T')) {
        dateStr = date.split('T')[0]
      } else if (date.includes('/')) {
        const parts = date.split('/')
        if (parts.length === 3) {
          dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`
        }
      }
      
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        setRestockings([])
        return
      }
      
      const { data, error } = await supabase
        .from('restocking')
        .select(`
          *,
          item:items(*)
        `)
        .eq('date', dateStr)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setRestockings(data as (Restocking & { item?: Item })[])
      } else if (error) {
        setRestockings([])
      }
    } catch {
      setRestockings([])
    }
  }, [date])

  useEffect(() => {
    fetchItems()
    fetchSalesCallback()
    checkUserRole()
    fetchOpeningStockCallback()
    fetchRestockingCallback()
    if (userRole === 'staff' && date !== today) {
      setDate(today)
    }
  }, [date, userRole, isPastDate, today, fetchSalesCallback, fetchOpeningStockCallback, fetchRestockingCallback])

  // Refresh items when window gains focus (user might have added items in another tab)
  useEffect(() => {
    const handleFocus = () => {
      fetchItems()
      fetchOpeningStockCallback()
      fetchRestockingCallback()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchOpeningStockCallback, fetchRestockingCallback])

  useEffect(() => {
    if (selectedBatch && quantity) {
      const qty = parseFloat(quantity) || 0
      setTotalPrice((qty * selectedBatch.price).toFixed(2))
    }
  }, [selectedBatch, quantity])

  // Auto-select batch when item is selected
  useEffect(() => {
    if (selectedItem && !selectedBatch) {
      const normalizedDate = normalizeDate(date)
      
      const itemOpeningStock = openingStocks.find(os => {
        const osDate = normalizeDate(os.date)
        return os.item_id === selectedItem && osDate === normalizedDate
      })
      
      const itemRestockings = restockings.filter(r => {
        const restockDate = normalizeDate(r.date)
        return r.item_id === selectedItem && restockDate === normalizedDate
      })

      const batches: Array<{ type: 'opening_stock' | 'restocking'; id: string; price: number; available: number }> = []

      if (itemOpeningStock) {
        const openingQty = parseFloat(itemOpeningStock.quantity.toString())
        const openingPrice = itemOpeningStock.selling_price || itemOpeningStock.item?.selling_price || 0
        const openingCostPrice = itemOpeningStock.cost_price || itemOpeningStock.item?.cost_price || 0
        
        const openingSales = sales.filter(s => {
          const saleDate = normalizeDate(s.date)
          return s.item_id === selectedItem && 
                 saleDate === normalizedDate && 
                 s.opening_stock_id === itemOpeningStock.id
        }).reduce((sum, s) => {
          if (editingSale && s.id === editingSale.id) return sum
          return sum + parseFloat(s.quantity.toString())
        }, 0)
        
        const available = Math.max(0, openingQty - openingSales)
        
        batches.push({
          type: 'opening_stock',
          id: itemOpeningStock.id,
          price: openingPrice || openingCostPrice,
          available
        })
      }

      itemRestockings.forEach(restocking => {
        const restockQty = parseFloat(restocking.quantity.toString())
        const restockPrice = restocking.selling_price || restocking.item?.selling_price || 0
        const restockCostPrice = restocking.cost_price || restocking.item?.cost_price || 0
        
        const restockSales = sales.filter(s => {
          const saleDate = normalizeDate(s.date)
          return s.item_id === selectedItem && saleDate === normalizedDate && s.restocking_id === restocking.id
        }).reduce((sum, s) => {
          if (editingSale && s.id === editingSale.id) return sum
          return sum + parseFloat(s.quantity.toString())
        }, 0)
        
        const available = Math.max(0, restockQty - restockSales)
        
        batches.push({
          type: 'restocking',
          id: restocking.id,
          price: restockPrice || restockCostPrice,
          available
        })
      })

      // Auto-select the best batch: prefer restocking batches with available stock, then opening stock
      if (batches.length > 0) {
        const bestBatch = batches.find(b => b.type === 'restocking' && b.available > 0) || 
                         batches.find(b => b.type === 'opening_stock' && b.available > 0) ||
                         batches[0]
        
        if (bestBatch) {
          setSelectedBatch({
            type: bestBatch.type,
            id: bestBatch.id,
            price: bestBatch.price,
            label: '',
            available: bestBatch.available
          })
          setPricePerUnit(bestBatch.price.toFixed(2))
        }
      }
    }
  }, [selectedItem, date, openingStocks, restockings, sales, editingSale])

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .limit(1)
      
      const profile = profileData && profileData.length > 0 ? profileData[0] : null
      if (profile) {
        setUserRole(profile.role)
      }
    }
  }

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase.from('items').select('*').order('name')
      if (error) {
        console.error('Error fetching items:', error)
        setMessage({ type: 'error', text: 'Failed to fetch items. Please refresh the page.' })
      } else {
        setItems(data || [])
      }
    } catch (error) {
      console.error('Exception fetching items:', error)
      setMessage({ type: 'error', text: 'Failed to fetch items. Please refresh the page.' })
    }
  }

  const fetchSales = async () => {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        item:items(*),
        recorded_by_profile:profiles(*),
        restocking:restocking(*),
        opening_stock:opening_stock(*)
      `)
      .eq('date', date)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setSales(data)
    }
  }

  const fetchOpeningStock = async () => {
    try {
      let dateStr = date
      
      if (date.includes('T')) {
        dateStr = date.split('T')[0]
      } else if (date.includes('/')) {
        const parts = date.split('/')
        if (parts.length === 3) {
          dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`
        }
      }
      
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        setMessage({ 
          type: 'error', 
          text: `Invalid date format: ${date}. Please select a valid date.` 
        })
        setOpeningStocks([])
        return
      }
      
      const { data, error } = await supabase
        .from('opening_stock')
        .select(`
          *,
          item:items(*)
        `)
        .eq('date', dateStr)
      .order('created_at', { ascending: false })

    if (error) {
        setMessage({ 
          type: 'error', 
          text: `Error fetching opening stock: ${error.message}` 
        })
        setOpeningStocks([])
        return
      }

      if (data && data.length > 0) {
        const uniqueOpeningStocks = data.reduce((acc, current) => {
          const existing = acc.find((item: typeof data[0]) => item.item_id === current.item_id)
          if (!existing) {
            acc.push(current)
    } else {
            const currentDateMatch = current.date === dateStr
            const existingDateMatch = existing.date === dateStr
            
            if (currentDateMatch && !existingDateMatch) {
              const index = acc.indexOf(existing)
              acc[index] = current
            } else if (!currentDateMatch && existingDateMatch) {
            } else {
              if (new Date(current.created_at) > new Date(existing.created_at)) {
                const index = acc.indexOf(existing)
                acc[index] = current
              }
            }
          }
          return acc
        }, [] as typeof data)
        
        setOpeningStocks(uniqueOpeningStocks as (OpeningStock & { item?: Item })[])
        if (message?.type === 'error' && message.text.includes('opening stock')) {
          setMessage(null)
        }
      } else {
        setOpeningStocks([])
        if (isPastDate) {
          setMessage({ 
            type: 'error', 
            text: `No opening stock found for ${dateStr}. Please record opening stock first for this date.` 
          })
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setMessage({ 
        type: 'error', 
        text: `Failed to fetch opening stock: ${errorMessage}. Please try again.` 
      })
      setOpeningStocks([])
    }
  }

  const fetchRestocking = async () => {
    try {
      let dateStr = date
      if (date.includes('T')) {
        dateStr = date.split('T')[0]
      } else if (date.includes('/')) {
        const parts = date.split('/')
        if (parts.length === 3) {
          dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`
        }
      }
      
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        setRestockings([])
        return
      }
      
      const { data, error } = await supabase
        .from('restocking')
        .select(`
          *,
          item:items(*)
        `)
        .eq('date', dateStr)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setRestockings(data as (Restocking & { item?: Item })[])
      } else if (error) {
        setRestockings([])
      }
    } catch {
      setRestockings([])
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

      // Superadmins cannot perform sales operations
      if (userRole === 'superadmin') {
        setMessage({ 
          type: 'error', 
          text: 'Superadmins cannot record sales. Please contact the organization admin.' 
        })
        setLoading(false)
        return
      }

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
        if (!selectedBatch) {
          setMessage({ 
            type: 'error', 
            text: 'Please select a batch (price) for this item' 
          })
          setLoading(false)
          return
        }

        const quantityValue = parseFloat(quantity)
        
        if (isNaN(quantityValue) || quantityValue <= 0) {
          setMessage({ 
            type: 'error', 
            text: 'Please enter a valid quantity greater than 0' 
          })
          setLoading(false)
          return
        }

        if (quantityValue > selectedBatch.available) {
          setMessage({ 
            type: 'error', 
            text: `Cannot record sales of ${quantityValue}. Available in this batch: ${selectedBatch.available}` 
          })
          setLoading(false)
          return
        }

        const { data: freshItemData, error: itemError } = await supabase
          .from('items')
          .select('quantity, name, unit')
          .eq('id', selectedItem)
          .limit(1)

        const freshItem = freshItemData && freshItemData.length > 0 ? freshItemData[0] : null
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
        
        let availableStock = 0
        let stockInfo = ''
        
        if (isPastDate) {
          const normalizedDate = date.split('T')[0]
          if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
            setMessage({ 
              type: 'error', 
              text: `Invalid date format: ${date}. Please select a valid date.` 
            })
            setLoading(false)
            return
          }
          
          const { data: openingStockData } = await supabase
            .from('opening_stock')
            .select('quantity')
            .eq('item_id', selectedItem)
            .eq('date', normalizedDate)
            .limit(1)

          const { data: restocking } = await supabase
            .from('restocking')
            .select('quantity')
            .eq('item_id', selectedItem)
            .eq('date', normalizedDate)

          const { data: existingSales } = await supabase
            .from('sales')
            .select('id, quantity')
            .eq('item_id', selectedItem)
            .eq('date', normalizedDate)

          const openingStock = openingStockData && openingStockData.length > 0 ? openingStockData[0] : null
          const openingQty = openingStock ? parseFloat(openingStock.quantity.toString()) : 0
          const totalRestocking = restocking?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0
          const totalSalesSoFar = existingSales?.reduce((sum, s) => {
            if (editingSale && s.id === editingSale.id) return sum
            return sum + parseFloat(s.quantity.toString())
          }, 0) || 0

          availableStock = openingQty + totalRestocking - totalSalesSoFar
          stockInfo = `Opening: ${openingQty}, Restocked: ${totalRestocking}, Sold: ${totalSalesSoFar}`
        } else {
          const normalizedDate = date.split('T')[0]
          
          const { data: openingStockData } = await supabase
            .from('opening_stock')
            .select('quantity')
            .eq('item_id', selectedItem)
            .eq('date', normalizedDate)
            .limit(1)

          const { data: restocking } = await supabase
            .from('restocking')
            .select('quantity')
            .eq('item_id', selectedItem)
            .eq('date', normalizedDate)

          const { data: existingSales } = await supabase
            .from('sales')
            .select('id, quantity')
            .eq('item_id', selectedItem)
            .eq('date', normalizedDate)

          const openingStock = openingStockData && openingStockData.length > 0 ? openingStockData[0] : null
          const openingQty = openingStock ? parseFloat(openingStock.quantity.toString()) : 0
          const totalRestocking = restocking?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0
          const totalSalesSoFar = existingSales?.reduce((sum, s) => {
            if (editingSale && s.id === editingSale.id) return sum
            return sum + parseFloat(s.quantity.toString())
          }, 0) || 0
          
          availableStock = openingQty + totalRestocking - totalSalesSoFar
          stockInfo = `Opening: ${openingQty}, Restocked: ${totalRestocking}, Sold today: ${totalSalesSoFar}`
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
              date: normalizeDate(date),
              description: description || null,
              old_quantity: editingSale.quantity,
              user_id: user.id,
            }),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update sales')
        }

        setMessage({ type: 'success', text: 'Sales record updated successfully!' })
        setEditingSale(null)
        } else {
          // Normalize date before sending to API
          const normalizedDateForAPI = normalizeDate(date)
          
          const response = await fetch('/api/sales/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
        item_id: selectedItem,
        quantity: parseFloat(quantity),
              price_per_unit: parseFloat(pricePerUnit) || 0,
              total_price: parseFloat(totalPrice) || 0,
              payment_mode: paymentMode,
        date: normalizedDateForAPI,
              description: description || null,
              user_id: user.id,
              restocking_id: selectedBatch && selectedBatch.type === 'restocking' ? selectedBatch.id : null,
              opening_stock_id: selectedBatch && selectedBatch.type === 'opening_stock' ? selectedBatch.id : null,
              batch_label: selectedBatch ? selectedBatch.label : null,
            }),
      })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to record sales')
        }

        setMessage({ type: 'success', text: 'Sales recorded successfully!' })
      }
      
      // Clear form but keep the date
      setQuantity('')
      setPricePerUnit('')
      setTotalPrice('')
      setPaymentMode('cash')
      setDescription('')
      setSelectedItem('')
      setSelectedBatch(null)
      
      // Force refresh all data to show updated availability and sales
      // Use a small delay to ensure database has updated
      setTimeout(async () => {
        await fetchSalesCallback()
        await fetchItems()
        await fetchOpeningStockCallback()
        await fetchRestockingCallback()
      }, 500)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to record sales'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (sale: Sale) => {
    const today = format(new Date(), 'yyyy-MM-dd')
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
    setDate(today)
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
    setSelectedBatch(null)
    setDate(format(new Date(), 'yyyy-MM-dd'))
  }

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
    if (!confirm('Are you sure you want to delete this sales record?')) return

    setLoading(true)
    try {
      const saleToDelete = sales.find(s => s.id === id)
      if (!saleToDelete) {
        setMessage({ type: 'error', text: 'Sales record not found' })
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setMessage({ type: 'error', text: 'You must be logged in' })
        setLoading(false)
        return
      }

      const response = await fetch(`/api/sales/delete?sale_id=${id}&item_id=${saleToDelete.item_id}&quantity=${saleToDelete.quantity}&date=${saleToDelete.date}&user_id=${user.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete sales record')
      }

      setMessage({ type: 'success', text: 'Sales record deleted successfully!' })
      await fetchSalesCallback()
      fetchItems()
      fetchOpeningStockCallback()
      fetchRestockingCallback()
      setSelectedBatch(null)
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
            Date {userRole !== 'admin' && userRole !== 'superadmin' && <span className="text-xs text-gray-500">(Today only)</span>}
            {(userRole === 'admin' || userRole === 'superadmin') && <span className="text-xs text-gray-500">(Admin: Can select past dates)</span>}
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => {
              const selectedDate = e.target.value
              const today = format(new Date(), 'yyyy-MM-dd')
              
              if (userRole !== 'admin' && userRole !== 'superadmin' && selectedDate !== today) {
                setMessage({ type: 'error', text: 'Sales can only be recorded for today\'s date.' })
                setDate(today)
                return
              }
              
              if (selectedDate > today) {
                setMessage({ type: 'error', text: 'Cannot record sales for future dates.' })
                setDate(today)
                return
              }
              
              setDate(selectedDate)
              setMessage(null)
            }}
            max={format(new Date(), 'yyyy-MM-dd')}
            required
            disabled={userRole !== 'admin' && userRole !== 'superadmin'}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 ${
              userRole !== 'admin' && userRole !== 'superadmin' ? 'bg-gray-50 cursor-not-allowed' : ''
            }`}
            readOnly={userRole !== 'admin' && userRole !== 'superadmin'}
          />
          <p className="mt-1 text-xs text-gray-500">
            {userRole === 'admin' || userRole === 'superadmin' 
              ? 'Admins can record sales for past dates to backfill data. Staff can only record for today.' 
              : 'Sales can only be recorded for today to avoid confusion'}
          </p>
        </div>

        <div>
          <label htmlFor="item" className="block text-sm font-medium text-gray-700 mb-1">
            Item Used
            {isPastDate && <span className="text-xs text-gray-500 ml-1">(From opening stock of this date)</span>}
          </label>
          <select
            id="item"
            value={selectedItem}
            onChange={(e) => {
              setSelectedItem(e.target.value)
              setSelectedBatch(null)
              setPricePerUnit('')
              setTotalPrice('')
            }}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 cursor-pointer"
          >
            <option value="">Select an item</option>
            {isPastDate ? (
              openingStocks.length > 0 ? (
                openingStocks.map((openingStock) => {
                  const item = openingStock.item
                  if (!item) return null
                  
                  const normalizedDate = date.split('T')[0]
                  
                  const itemRestocking = restockings.filter(r => {
                    const restockDate = r.date.split('T')[0]
                    return r.item_id === item.id && restockDate === normalizedDate
                  })
                  const totalRestocking = itemRestocking.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0)
                  
                  const itemSales = sales.filter(s => {
                    const saleDate = s.date.split('T')[0]
                    return s.item_id === item.id && saleDate === normalizedDate
                  })
                  const totalSales = itemSales.reduce((sum, s) => {
                    if (editingSale && s.id === editingSale.id) return sum
                    return sum + s.quantity
                  }, 0)
                  
                  const openingQty = parseFloat(openingStock.quantity.toString())
                  const available = Math.max(0, openingQty + totalRestocking - totalSales)
                  
                  const displayText = totalRestocking > 0
                    ? `${item.name} (${item.unit}) - Available: ${available > 0 ? available : 0} (Opening Stock: ${openingQty}, Restocked: ${totalRestocking})`
                    : `${item.name} (${item.unit}) - Available: ${available > 0 ? available : 0} (Opening Stock: ${openingQty})`
                  
                  return (
                    <option key={item.id} value={item.id}>
                      {displayText}
                    </option>
                  )
                })
              ) : (
                <option value="" disabled>
                  No opening stock found for this date. Please record opening stock first.
                </option>
              )
            ) : (
              items.length > 0 ? (
                items.map((item) => {
                  const normalizedDate = normalizeDate(date)
                  
                  const itemOpeningStock = openingStocks.find(os => {
                    const osDate = normalizeDate(os.date)
                    return os.item_id === item.id && osDate === normalizedDate
                  })
                  const openingQty = itemOpeningStock ? parseFloat(itemOpeningStock.quantity.toString()) : 0
                  
                  const itemRestocking = restockings.filter(r => {
                    const restockDate = normalizeDate(r.date)
                    return r.item_id === item.id && restockDate === normalizedDate
                  })
                  const totalRestocking = itemRestocking.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0)
                  
                  // Count ALL sales for this item on this date (not just from specific batch)
                  // This gives the total available stock across all batches
                  const itemSales = sales.filter(s => {
                    const saleDate = normalizeDate(s.date)
                    return s.item_id === item.id && saleDate === normalizedDate
                  })
                  const totalSales = itemSales.reduce((sum, s) => {
                    if (editingSale && s.id === editingSale.id) return sum
                    return sum + parseFloat(s.quantity.toString())
                  }, 0)
                  
                  const available = Math.max(0, openingQty + totalRestocking - totalSales)
                  
                  const displayText = totalRestocking > 0
                    ? `${item.name} (${item.unit}) - Available: ${available > 0 ? available : 0} (Opening Stock: ${openingQty}, Restocked: ${totalRestocking})`
                    : `${item.name} (${item.unit}) - Available: ${available > 0 ? available : 0} (Opening Stock: ${openingQty})`
                  
                  return (
                    <option key={item.id} value={item.id}>
                      {displayText}
                    </option>
                  )
                })
              ) : (
                <option value="" disabled>
                  No items found. Please add items first.
                </option>
              )
            )}
          </select>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                fetchItems()
                fetchSalesCallback()
                fetchOpeningStockCallback()
                fetchRestockingCallback()
                setMessage({ type: 'success', text: 'Items list refreshed!' })
                setTimeout(() => setMessage(null), 2000)
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 underline"
            >
              Refresh Items List
            </button>
            {items.length > 0 && (
              <span className="text-xs text-gray-500">
                ({items.length} items loaded)
              </span>
            )}
          </div>
          {isPastDate && openingStocks.length === 0 && (
            <p className="mt-1 text-xs text-red-500">
              No opening stock found for this date. Please record opening stock first.
            </p>
          )}
        </div>

        {selectedItem && (() => {
          const normalizedDate = normalizeDate(date)
          
          const itemOpeningStock = openingStocks.find(os => {
            const osDate = normalizeDate(os.date)
            return os.item_id === selectedItem && osDate === normalizedDate
          })
          
          const itemRestockings = restockings.filter(r => {
            const restockDate = normalizeDate(r.date)
            return r.item_id === selectedItem && restockDate === normalizedDate
          })

          const batches: Array<{ type: 'opening_stock' | 'restocking'; id: string; price: number; label: string; available: number }> = []

          if (itemOpeningStock) {
            const openingQty = parseFloat(itemOpeningStock.quantity.toString())
            const openingPrice = itemOpeningStock.selling_price || itemOpeningStock.item?.selling_price || 0
            const openingCostPrice = itemOpeningStock.cost_price || itemOpeningStock.item?.cost_price || 0
            
            const openingSales = sales.filter(s => {
              const saleDate = normalizeDate(s.date)
              return s.item_id === selectedItem && 
                     saleDate === normalizedDate && 
                     s.opening_stock_id === itemOpeningStock.id
            }).reduce((sum, s) => {
              if (editingSale && s.id === editingSale.id) return sum
              return sum + parseFloat(s.quantity.toString())
            }, 0)
            
            const available = Math.max(0, openingQty - openingSales)
            
            batches.push({
              type: 'opening_stock',
              id: itemOpeningStock.id,
              price: openingPrice || openingCostPrice,
              label: `Opening Stock - ${openingPrice > 0 ? `₦${openingPrice.toFixed(2)}` : openingCostPrice > 0 ? `Cost: ₦${openingCostPrice.toFixed(2)}` : 'No price'} (Available: ${available})`,
              available
            })
          }

          itemRestockings.forEach(restocking => {
            const restockQty = parseFloat(restocking.quantity.toString())
            const restockPrice = restocking.selling_price || restocking.item?.selling_price || 0
            const restockCostPrice = restocking.cost_price || restocking.item?.cost_price || 0
            
            const restockSales = sales.filter(s => {
              const saleDate = normalizeDate(s.date)
              return s.item_id === selectedItem && saleDate === normalizedDate && s.restocking_id === restocking.id
            }).reduce((sum, s) => {
              if (editingSale && s.id === editingSale.id) return sum
              return sum + parseFloat(s.quantity.toString())
            }, 0)
            
            const available = Math.max(0, restockQty - restockSales)
            
            batches.push({
              type: 'restocking',
              id: restocking.id,
              price: restockPrice || restockCostPrice,
              label: `Restocked - ${restockPrice > 0 ? `₦${restockPrice.toFixed(2)}` : restockCostPrice > 0 ? `Cost: ₦${restockCostPrice.toFixed(2)}` : 'No price'} (Available: ${available})`,
              available
            })
          })

          // Auto-select the best batch: prefer restocking batches with available stock, then opening stock
          if (batches.length > 0 && !selectedBatch) {
            const bestBatch = batches.find(b => b.type === 'restocking' && b.available > 0) || 
                             batches.find(b => b.type === 'opening_stock' && b.available > 0) ||
                             batches[0] // Fallback to first batch if none available
            
            if (bestBatch) {
              setSelectedBatch(bestBatch)
              setPricePerUnit(bestBatch.price.toFixed(2))
              if (quantity) {
                setTotalPrice((parseFloat(quantity) * bestBatch.price).toFixed(2))
              }
            }
          }

          // Show price info but hide batch selection
          if (selectedBatch) {
            return (
              <div className="mt-1 text-xs text-gray-500">
                Selling from: {selectedBatch.type === 'opening_stock' ? 'Opening Stock' : 'Restocked Batch'} - 
                Price: ₦{selectedBatch.price.toFixed(2)}/unit - 
                Available: {selectedBatch.available} {items.find(i => i.id === selectedItem)?.unit || 'pieces'}
              </div>
            )
          }

          return null
        })()}

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

      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Sales/Usage Records</h3>
        {sales.length > 0 ? (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price/Unit</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Price</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Mode</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  {(userRole === 'admin' || userRole === 'superadmin') && (
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
                      {sale.batch_label ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {sale.batch_label}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No batch info</span>
                      )}
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
                    {(userRole === 'admin' || userRole === 'superadmin') && (
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
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No sales records found for {format(new Date(date), 'MMM dd, yyyy')}</p>
            <p className="text-sm text-gray-400 mt-2">Sales recorded for this date will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}

