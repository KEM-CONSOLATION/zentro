'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Item, Sale } from '@/types/database'
import { format } from 'date-fns'
import { useAuth } from '@/lib/hooks/useAuth'
import { useItemsStore } from '@/lib/stores/itemsStore'
import { useSalesStore } from '@/lib/stores/salesStore'
import { useStockStore } from '@/lib/stores/stockStore'
import Pagination from './Pagination'

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
  quantityToRecord,
  organizationId,
  branchId,
}: {
  itemId: string
  date: string
  sales: (Sale & { item?: Item })[]
  editingSale: Sale | null
  item: Item
  quantityToRecord?: number
  organizationId: string | null
  branchId?: string | null
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

        // Use organizationId from store
        const orgId = organizationId

        if (isPastDate) {
          // Get opening stock - prefer branch-specific, fallback to NULL branch_id
          let branchSpecificQuery = supabase
            .from('opening_stock')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)
          if (orgId) branchSpecificQuery = branchSpecificQuery.eq('organization_id', orgId)
          if (branchId) branchSpecificQuery = branchSpecificQuery.eq('branch_id', branchId)
          const { data: branchSpecificData } = await branchSpecificQuery.limit(1)

          // If no branch-specific found, try NULL branch_id as fallback
          let openingStockData = branchSpecificData
          if (!openingStockData || openingStockData.length === 0) {
            let nullBranchQuery = supabase
              .from('opening_stock')
              .select('quantity')
              .eq('item_id', itemId)
              .eq('date', normalizedDate)
              .is('branch_id', null)
            if (orgId) nullBranchQuery = nullBranchQuery.eq('organization_id', orgId)
            const { data: nullBranchData } = await nullBranchQuery.limit(1)
            openingStockData = nullBranchData
          }

          // Get restocking
          let restockingQuery = supabase
            .from('restocking')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)
          if (orgId) restockingQuery = restockingQuery.eq('organization_id', orgId)
          if (branchId) restockingQuery = restockingQuery.eq('branch_id', branchId)
          const { data: restocking } = await restockingQuery

          // Get waste/spoilage
          let wasteSpoilageQuery = supabase
            .from('waste_spoilage')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)
          if (orgId) wasteSpoilageQuery = wasteSpoilageQuery.eq('organization_id', orgId)
          if (branchId) wasteSpoilageQuery = wasteSpoilageQuery.eq('branch_id', branchId)
          const { data: wasteSpoilage } = await wasteSpoilageQuery

          // Get outgoing transfers (from this branch)
          let outgoingTransfersQuery = supabase
            .from('branch_transfers')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)
          if (orgId) outgoingTransfersQuery = outgoingTransfersQuery.eq('organization_id', orgId)
          if (branchId)
            outgoingTransfersQuery = outgoingTransfersQuery.eq('from_branch_id', branchId)
          const { data: outgoingTransfers } = await outgoingTransfersQuery

          // Get incoming transfers (to this branch)
          let incomingTransfersQuery = supabase
            .from('branch_transfers')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)
          if (orgId) incomingTransfersQuery = incomingTransfersQuery.eq('organization_id', orgId)
          if (branchId) incomingTransfersQuery = incomingTransfersQuery.eq('to_branch_id', branchId)
          const { data: incomingTransfers } = await incomingTransfersQuery

          const openingStock =
            openingStockData && openingStockData.length > 0 ? openingStockData[0] : null
          const openingQty = openingStock ? parseFloat(openingStock.quantity.toString()) : 0
          const totalRestocking =
            restocking?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0
          const totalWasteSpoilage =
            wasteSpoilage?.reduce((sum, ws) => sum + parseFloat(ws.quantity.toString()), 0) || 0
          const totalOutgoingTransfers =
            outgoingTransfers?.reduce((sum, t) => sum + parseFloat(t.quantity.toString()), 0) || 0
          const totalIncomingTransfers =
            incomingTransfers?.reduce((sum, t) => sum + parseFloat(t.quantity.toString()), 0) || 0

          // Available stock before this sale
          const available =
            openingQty +
            totalRestocking +
            totalIncomingTransfers -
            totalSales -
            totalOutgoingTransfers
          // Closing stock after this sale = Opening + Restocking + Incoming Transfers - Sales - Waste/Spoilage - Outgoing Transfers
          const closing =
            openingQty +
            totalRestocking +
            totalIncomingTransfers -
            salesIncludingNew -
            totalWasteSpoilage -
            totalOutgoingTransfers

          if (isMounted) {
            setAvailableStock(available)
            setClosingStock(closing)
            const transferInfo =
              totalIncomingTransfers > 0 || totalOutgoingTransfers > 0
                ? `, Transfers In: ${totalIncomingTransfers}, Out: ${totalOutgoingTransfers}`
                : ''
            setStockInfo(
              `Opening: ${openingQty}, Restocked: ${totalRestocking}, Sold: ${totalSales}, Waste/Spoilage: ${totalWasteSpoilage}${transferInfo}`
            )
          }
        } else {
          // Get opening stock - prefer branch-specific, fallback to NULL branch_id
          let branchSpecificQuery = supabase
            .from('opening_stock')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)
          if (orgId) branchSpecificQuery = branchSpecificQuery.eq('organization_id', orgId)
          if (branchId) branchSpecificQuery = branchSpecificQuery.eq('branch_id', branchId)
          const { data: branchSpecificData } = await branchSpecificQuery.limit(1)

          // If no branch-specific found, try NULL branch_id as fallback
          let openingStockData = branchSpecificData
          if (!openingStockData || openingStockData.length === 0) {
            let nullBranchQuery = supabase
              .from('opening_stock')
              .select('quantity')
              .eq('item_id', itemId)
              .eq('date', normalizedDate)
              .is('branch_id', null)
            if (orgId) nullBranchQuery = nullBranchQuery.eq('organization_id', orgId)
            const { data: nullBranchData } = await nullBranchQuery.limit(1)
            openingStockData = nullBranchData
          }

          // Get restocking
          let restockingQuery = supabase
            .from('restocking')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)
          if (orgId) restockingQuery = restockingQuery.eq('organization_id', orgId)
          if (branchId) restockingQuery = restockingQuery.eq('branch_id', branchId)
          const { data: restocking } = await restockingQuery

          // Get waste/spoilage
          let wasteSpoilageQuery = supabase
            .from('waste_spoilage')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)
          if (orgId) wasteSpoilageQuery = wasteSpoilageQuery.eq('organization_id', orgId)
          if (branchId) wasteSpoilageQuery = wasteSpoilageQuery.eq('branch_id', branchId)
          const { data: wasteSpoilage } = await wasteSpoilageQuery

          // Get outgoing transfers (from this branch)
          let outgoingTransfersQuery = supabase
            .from('branch_transfers')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)
          if (orgId) outgoingTransfersQuery = outgoingTransfersQuery.eq('organization_id', orgId)
          if (branchId)
            outgoingTransfersQuery = outgoingTransfersQuery.eq('from_branch_id', branchId)
          const { data: outgoingTransfers } = await outgoingTransfersQuery

          // Get incoming transfers (to this branch)
          let incomingTransfersQuery = supabase
            .from('branch_transfers')
            .select('quantity')
            .eq('item_id', itemId)
            .eq('date', normalizedDate)
          if (orgId) incomingTransfersQuery = incomingTransfersQuery.eq('organization_id', orgId)
          if (branchId) incomingTransfersQuery = incomingTransfersQuery.eq('to_branch_id', branchId)
          const { data: incomingTransfers } = await incomingTransfersQuery

          const openingStock =
            openingStockData && openingStockData.length > 0 ? openingStockData[0] : null
          const openingQty = openingStock ? parseFloat(openingStock.quantity.toString()) : 0
          const totalRestocking =
            restocking?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0
          const totalWasteSpoilage =
            wasteSpoilage?.reduce((sum, ws) => sum + parseFloat(ws.quantity.toString()), 0) || 0
          const totalOutgoingTransfers =
            outgoingTransfers?.reduce((sum, t) => sum + parseFloat(t.quantity.toString()), 0) || 0
          const totalIncomingTransfers =
            incomingTransfers?.reduce((sum, t) => sum + parseFloat(t.quantity.toString()), 0) || 0

          // Available stock before this sale
          const available =
            openingQty +
            totalRestocking +
            totalIncomingTransfers -
            totalSales -
            totalOutgoingTransfers
          // Closing stock after this sale = Opening + Restocking + Incoming Transfers - Sales - Waste/Spoilage - Outgoing Transfers
          const closing =
            openingQty +
            totalRestocking +
            totalIncomingTransfers -
            salesIncludingNew -
            totalWasteSpoilage -
            totalOutgoingTransfers

          if (isMounted) {
            setAvailableStock(available)
            setClosingStock(closing)
            const transferInfo =
              totalIncomingTransfers > 0 || totalOutgoingTransfers > 0
                ? `, Transfers In: ${totalIncomingTransfers}, Out: ${totalOutgoingTransfers}`
                : ''
            setStockInfo(
              `Opening: ${openingQty}, Restocked: ${totalRestocking}, Sold today: ${totalSales}, Waste/Spoilage: ${totalWasteSpoilage}${transferInfo}`
            )
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
  }, [itemId, date, quantityToRecord, isPastDate, organizationId, branchId])

  if (loading) {
    return <p className="text-xs text-gray-500">Calculating availability...</p>
  }

  return (
    <div className="space-y-1">
      <p
        className={`text-xs ${availableStock !== null && availableStock > 0 ? 'text-gray-500' : 'text-red-600'}`}
      >
        Available stock: {availableStock !== null && availableStock > 0 ? availableStock : 0}{' '}
        {item.unit}
      </p>
      {closingStock !== null && (
        <p className="text-xs text-blue-600 font-medium">
          Closing stock after this sale: {closingStock > 0 ? closingStock : 0} {item.unit}
        </p>
      )}
      <p className="text-xs text-gray-400">({stockInfo})</p>
    </div>
  )
}

export default function SalesForm() {
  const {
    user,
    profile,
    organizationId,
    branchId,
    isAdmin,
    isSuperAdmin,
    isStaff,
    isTenantAdmin,
    currentBranch,
  } = useAuth()

  // Use Zustand stores
  const { items, fetchItems: fetchItemsFromStore } = useItemsStore()
  const {
    sales,
    fetchSales: fetchSalesFromStore,
    addSale,
    updateSale,
    removeSale,
  } = useSalesStore()
  const {
    openingStocks,
    restockings,
    fetchOpeningStock: fetchOpeningStockFromStore,
    fetchRestocking: fetchRestockingFromStore,
  } = useStockStore()
  const [selectedItem, setSelectedItem] = useState('')
  const [selectedBatch, setSelectedBatch] = useState<{
    type: 'opening_stock' | 'restocking'
    id: string
    price: number
    label: string
    available: number
  } | null>(null)
  // Track if user manually selected a batch (to prevent auto-selection from overriding)
  const manuallySelectedBatchRef = useRef(false)
  const [quantity, setQuantity] = useState('')
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [totalPrice, setTotalPrice] = useState('')
  const [paymentMode, setPaymentMode] = useState<'cash' | 'transfer'>('cash')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10 // Reduced to show pagination more readily
  const today = format(new Date(), 'yyyy-MM-dd')
  const isPastDate = date < today

  // Derive userRole from profile
  const userRole = profile?.role || null

  // Helper to check if user can record sales (staff, branch_manager, and admin can, but not superadmin)
  const canRecordSales =
    !isSuperAdmin &&
    (isAdmin || isStaff || userRole === 'branch_manager' || userRole === 'tenant_admin')

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

  // Fetch sales from store
  const fetchSalesCallback = useCallback(async () => {
    const dateStr = normalizeDate(date)

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      console.error('Invalid date format:', date)
      return
    }

    await fetchSalesFromStore(dateStr, organizationId, branchId)
  }, [date, normalizeDate, organizationId, branchId, fetchSalesFromStore])

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
          text: `Invalid date format: ${date}. Please select a valid date.`,
        })
        return
      }

      // Force refresh to get latest data after SQL fixes
      await fetchOpeningStockFromStore(dateStr, organizationId, branchId, true)

      // Check for errors after fetch
      if (isPastDate && openingStocks.length === 0) {
        setMessage({
          type: 'error',
          text: `No opening stock found for ${dateStr}. Please record opening stock first for this date.`,
        })
      } else if (message?.type === 'error' && message.text.includes('opening stock')) {
        setMessage(null)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setMessage({
        type: 'error',
        text: `Failed to fetch opening stock: ${errorMessage}. Please try again.`,
      })
    }
  }, [
    date,
    isPastDate,
    message,
    organizationId,
    branchId,
    fetchOpeningStockFromStore,
    openingStocks.length,
  ])

  // Refresh opening stock when branch changes
  useEffect(() => {
    if (!organizationId || !date) return

    const dateStr = date.includes('T')
      ? date.split('T')[0]
      : date.includes('/')
        ? (() => {
            const parts = date.split('/')
            return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : date
          })()
        : date

    // Force refresh when branch changes to get correct branch-specific data
    fetchOpeningStockFromStore(dateStr, organizationId, branchId, true)
  }, [branchId, organizationId, date, fetchOpeningStockFromStore])

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
        return
      }

      await fetchRestockingFromStore(dateStr, organizationId, branchId)
    } catch (error) {
      console.error('Error fetching restocking:', error)
    }
  }, [date, organizationId, branchId, fetchRestockingFromStore])

  useEffect(() => {
    // Fetch all data from stores
    if (organizationId) {
      fetchItemsFromStore(organizationId, branchId)
    }
    fetchSalesCallback()
    fetchOpeningStockCallback()
    fetchRestockingCallback()
    if (isStaff && date !== today) {
      setDate(today)
    }

    // Auto-create opening stock for today if it doesn't exist
    const autoCreateTodayOpeningStock = async () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const normalizedDate = normalizeDateStr(date)

      // Only auto-create for today's date
      if (normalizedDate === todayStr && user) {
        try {
          // Use organizationId from store
          const orgId = organizationId

          let openingStockQuery = supabase
            .from('opening_stock')
            .select('id')
            .eq('date', todayStr)
            .limit(1)

          if (orgId) {
            openingStockQuery = openingStockQuery.eq('organization_id', orgId)
          }

          const { data: existingOpeningStock } = await openingStockQuery

          // If no opening stock exists, create it
          if (!existingOpeningStock || existingOpeningStock.length === 0) {
            const response = await fetch('/api/stock/auto-create-opening', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                date: todayStr,
                user_id: user.id,
                branch_id: branchId, // Pass selected branch for admins
              }),
            })

            if (response.ok) {
              // Refresh opening stock after creation
              setTimeout(() => {
                fetchOpeningStockCallback()
                if (organizationId) {
                  fetchItemsFromStore(organizationId, branchId)
                }
              }, 500)
            }
          }
        } catch (error) {
          console.error('Error auto-creating opening stock:', error)
        }
      }
    }

    autoCreateTodayOpeningStock()
  }, [
    date,
    isStaff,
    isPastDate,
    today,
    fetchSalesCallback,
    fetchOpeningStockCallback,
    fetchRestockingCallback,
    user,
    organizationId,
    fetchItemsFromStore,
    branchId,
  ])

  // Refresh items when window gains focus (user might have added items in another tab)
  useEffect(() => {
    const handleFocus = () => {
      if (organizationId) {
        fetchItemsFromStore(organizationId)
      }
      fetchOpeningStockCallback()
      fetchRestockingCallback()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchOpeningStockCallback, fetchRestockingCallback, organizationId, fetchItemsFromStore])

  useEffect(() => {
    if (selectedBatch && quantity) {
      const qty = parseFloat(quantity) || 0
      setTotalPrice((qty * selectedBatch.price).toFixed(2))
    }
  }, [selectedBatch, quantity])

  // Helper function to get all available batches for the selected item
  const getAvailableBatches = useCallback(() => {
    if (!selectedItem) return []

    const normalizedDate = normalizeDate(date)
    const batches: Array<{
      type: 'opening_stock' | 'restocking'
      id: string
      price: number
      available: number
      label: string
      date?: string
    }> = []

    const itemOpeningStock = openingStocks.find(os => {
      const osDate = normalizeDate(os.date)
      return os.item_id === selectedItem && osDate === normalizedDate
    })

    if (itemOpeningStock) {
      const openingQty = parseFloat(itemOpeningStock.quantity.toString())
      const openingPrice =
        itemOpeningStock.selling_price || itemOpeningStock.item?.selling_price || 0
      const openingCostPrice = itemOpeningStock.cost_price || itemOpeningStock.item?.cost_price || 0

      const openingSales = sales
        .filter(s => {
          const saleDate = normalizeDate(s.date)
          return (
            s.item_id === selectedItem &&
            saleDate === normalizedDate &&
            s.opening_stock_id === itemOpeningStock.id
          )
        })
        .reduce((sum, s) => {
          if (editingSale && s.id === editingSale.id) return sum
          return sum + parseFloat(s.quantity.toString())
        }, 0)

      const available = Math.max(0, openingQty - openingSales)

      batches.push({
        type: 'opening_stock',
        id: itemOpeningStock.id,
        price: openingPrice || openingCostPrice,
        available,
        label: `Opening Stock - ₦${(openingPrice || openingCostPrice).toFixed(2)} (Available: ${available})`,
        date: itemOpeningStock.date,
      })
    }

    const itemRestockings = restockings.filter(r => {
      const restockDate = normalizeDate(r.date)
      return r.item_id === selectedItem && restockDate === normalizedDate
    })

    itemRestockings.forEach(restocking => {
      const restockDate = normalizeDate(restocking.date)
      if (restockDate !== normalizedDate) return

      const restockQty = parseFloat(restocking.quantity.toString())
      const restockPrice = restocking.selling_price || restocking.item?.selling_price || 0
      const restockCostPrice = restocking.cost_price || restocking.item?.cost_price || 0

      const restockSales = sales
        .filter(s => {
          const saleDate = normalizeDate(s.date)
          return (
            s.item_id === selectedItem &&
            saleDate === normalizedDate &&
            s.restocking_id === restocking.id
          )
        })
        .reduce((sum, s) => {
          if (editingSale && s.id === editingSale.id) return sum
          return sum + parseFloat(s.quantity.toString())
        }, 0)

      const available = Math.max(0, restockQty - restockSales)

      batches.push({
        type: 'restocking',
        id: restocking.id,
        price: restockPrice || restockCostPrice,
        available,
        label: `Restocked - ₦${(restockPrice || restockCostPrice).toFixed(2)} (Available: ${available})`,
        date: restocking.date,
      })
    })

    // Sort batches: opening stock first, then restocking by date (oldest first for FIFO)
    // This ensures opening stock is prioritized for auto-selection
    return batches.sort((a, b) => {
      // Opening stock always comes first (highest priority)
      if (a.type === 'opening_stock' && b.type === 'restocking') return -1
      if (a.type === 'restocking' && b.type === 'opening_stock') return 1

      // If both are opening stock, prefer the one with more available stock
      if (a.type === 'opening_stock' && b.type === 'opening_stock') {
        return b.available - a.available
      }

      // If both are restocking, sort by date (older first for FIFO)
      if (a.type === 'restocking' && b.type === 'restocking' && a.date && b.date) {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        if (dateA !== dateB) return dateA - dateB
      }

      return 0
    })
  }, [selectedItem, date, openingStocks, restockings, sales, editingSale])

  // Auto-select batch when item is selected
  // Priority: Opening Stock first, then restocking batches
  // Only auto-select if user hasn't manually selected a batch
  useEffect(() => {
    if (selectedItem && !selectedBatch && !manuallySelectedBatchRef.current) {
      const batches = getAvailableBatches()

      // Auto-select opening stock first (if available), otherwise first restocking batch
      if (batches.length > 0) {
        // Prefer opening stock with available quantity
        const openingStockBatch = batches.find(b => b.type === 'opening_stock' && b.available > 0)

        // If no opening stock available, use first restocking batch with stock
        const restockingBatch = batches.find(b => b.type === 'restocking' && b.available > 0)

        // Fallback to any batch with stock, or just the first batch
        const bestBatch =
          openingStockBatch || restockingBatch || batches.find(b => b.available > 0) || batches[0]

        if (bestBatch) {
          setSelectedBatch({
            type: bestBatch.type,
            id: bestBatch.id,
            price: bestBatch.price,
            label: bestBatch.label,
            available: bestBatch.available,
          })
          setPricePerUnit(bestBatch.price.toFixed(2))
        }
      }
    }
  }, [selectedItem, date, getAvailableBatches, selectedBatch])

  // Reset manual selection flag when item changes
  useEffect(() => {
    manuallySelectedBatchRef.current = false
  }, [selectedItem])

  // User role is now derived from profile in store, no need for separate function

  // All data fetching is now handled by Zustand stores via fetch*Callback functions

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // Tenant admins must have a branch selected to record sales
    if (isTenantAdmin && (!branchId || !currentBranch)) {
      setMessage({
        type: 'error',
        text: 'Please select a branch from the branch selector above to record sales.',
      })
      setLoading(false)
      return
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      // Superadmins cannot perform sales operations
      if (isSuperAdmin) {
        setMessage({
          type: 'error',
          text: 'Superadmins cannot record sales. Please contact the organization admin.',
        })
        setLoading(false)
        return
      }

      // Verify user can record sales (staff, branch_manager, admin can)
      if (!canRecordSales) {
        setMessage({
          type: 'error',
          text: 'You do not have permission to record sales. Please contact your administrator.',
        })
        setLoading(false)
        return
      }

      const today = format(new Date(), 'yyyy-MM-dd')
      // Staff and branch_manager can only record for today; admins can record for past dates
      if (!isAdmin && date !== today) {
        setMessage({
          type: 'error',
          text: "Sales can only be recorded for today's date. Please use today's date.",
        })
        setDate(today) // Reset to today
        setLoading(false)
        return
      }

      if (date > today) {
        setMessage({
          type: 'error',
          text: 'Cannot record sales for future dates.',
        })
        setDate(today)
        setLoading(false)
        return
      }

      if (selectedItem) {
        if (!selectedBatch) {
          setMessage({
            type: 'error',
            text: 'Please select a batch (price) for this item',
          })
          setLoading(false)
          return
        }

        const quantityValue = parseFloat(quantity)

        if (isNaN(quantityValue) || quantityValue <= 0) {
          setMessage({
            type: 'error',
            text: 'Please enter a valid quantity greater than 0',
          })
          setLoading(false)
          return
        }

        if (quantityValue > selectedBatch.available) {
          setMessage({
            type: 'error',
            text: `Cannot record sales of ${quantityValue}. Available in this batch: ${selectedBatch.available}`,
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
            text: 'Item not found. Please refresh and try again.',
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
              text: `Invalid date format: ${date}. Please select a valid date.`,
            })
            setLoading(false)
            return
          }

          let openingStockQuery = supabase
            .from('opening_stock')
            .select('quantity')
            .eq('item_id', selectedItem)
            .eq('date', normalizedDate)
          if (branchId) {
            openingStockQuery = openingStockQuery.eq('branch_id', branchId)
          }
          const { data: openingStockData } = await openingStockQuery.limit(1)

          let restockingQuery = supabase
            .from('restocking')
            .select('quantity')
            .eq('item_id', selectedItem)
            .eq('date', normalizedDate)
          if (branchId) {
            restockingQuery = restockingQuery.eq('branch_id', branchId)
          }
          const { data: restocking } = await restockingQuery

          let salesQuery = supabase
            .from('sales')
            .select('id, quantity')
            .eq('item_id', selectedItem)
            .eq('date', normalizedDate)
          if (branchId) {
            salesQuery = salesQuery.eq('branch_id', branchId)
          }
          const { data: existingSales } = await salesQuery

          const openingStock =
            openingStockData && openingStockData.length > 0 ? openingStockData[0] : null
          const openingQty = openingStock ? parseFloat(openingStock.quantity.toString()) : 0
          const totalRestocking =
            restocking?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0
          const totalSalesSoFar =
            existingSales?.reduce((sum, s) => {
              if (editingSale && s.id === editingSale.id) return sum
              return sum + parseFloat(s.quantity.toString())
            }, 0) || 0

          availableStock = openingQty + totalRestocking - totalSalesSoFar
          stockInfo = `Opening: ${openingQty}, Restocked: ${totalRestocking}, Sold: ${totalSalesSoFar}`
        } else {
          const normalizedDate = date.split('T')[0]

          let openingStockQuery = supabase
            .from('opening_stock')
            .select('quantity')
            .eq('item_id', selectedItem)
            .eq('date', normalizedDate)
          if (branchId) {
            openingStockQuery = openingStockQuery.eq('branch_id', branchId)
          }
          const { data: openingStockData } = await openingStockQuery.limit(1)

          let restockingQuery = supabase
            .from('restocking')
            .select('quantity')
            .eq('item_id', selectedItem)
            .eq('date', normalizedDate)
          if (branchId) {
            restockingQuery = restockingQuery.eq('branch_id', branchId)
          }
          const { data: restocking } = await restockingQuery

          let salesQuery = supabase
            .from('sales')
            .select('id, quantity')
            .eq('item_id', selectedItem)
            .eq('date', normalizedDate)
          if (branchId) {
            salesQuery = salesQuery.eq('branch_id', branchId)
          }
          const { data: existingSales } = await salesQuery

          const openingStock =
            openingStockData && openingStockData.length > 0 ? openingStockData[0] : null
          const openingQty = openingStock ? parseFloat(openingStock.quantity.toString()) : 0
          const totalRestocking =
            restocking?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0
          const totalSalesSoFar =
            existingSales?.reduce((sum, s) => {
              if (editingSale && s.id === editingSale.id) return sum
              return sum + parseFloat(s.quantity.toString())
            }, 0) || 0

          availableStock = openingQty + totalRestocking - totalSalesSoFar
          stockInfo = `Opening: ${openingQty}, Restocked: ${totalRestocking}, Sold today: ${totalSalesSoFar}`
        }

        if (availableStock <= 0) {
          setMessage({
            type: 'error',
            text: `No available stock for ${date}. ${stockInfo}`,
          })
          setLoading(false)
          return
        }

        if (quantityValue > availableStock) {
          setMessage({
            type: 'error',
            text: `Cannot record sales of ${quantityValue}. Available stock: ${availableStock} (${stockInfo})`,
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
            branch_id: branchId,
          }),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update sales')
        }

        setMessage({ type: 'success', text: 'Sales record updated successfully!' })

        // Update store with the updated sale
        if (data.sale) {
          updateSale(data.sale.id, data.sale)
        }

        // Refresh data from stores
        await fetchSalesCallback()
        if (organizationId) {
          fetchItemsFromStore(organizationId, branchId)
        }
        fetchOpeningStockCallback()
        fetchRestockingCallback()

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
            branch_id: branchId,
            restocking_id:
              selectedBatch && selectedBatch.type === 'restocking' ? selectedBatch.id : null,
            opening_stock_id:
              selectedBatch && selectedBatch.type === 'opening_stock' ? selectedBatch.id : null,
            batch_label: selectedBatch ? selectedBatch.label : null,
          }),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to record sales')
        }

        setMessage({ type: 'success', text: 'Sales recorded successfully!' })

        // Add sale to store
        if (data.sale) {
          addSale(data.sale)
        }

        // Refresh data from stores
        await fetchSalesCallback()
        if (organizationId) {
          fetchItemsFromStore(organizationId, branchId)
        }
        fetchOpeningStockCallback()
        fetchRestockingCallback()
      }

      // Clear form but keep the date
      setQuantity('')
      setPricePerUnit('')
      setTotalPrice('')
      setPaymentMode('cash')
      setDescription('')
      setSelectedItem('')
      setSelectedBatch(null)
      manuallySelectedBatchRef.current = false

      // Force refresh all data to show updated availability and sales
      // Use a small delay to ensure database has updated
      setTimeout(async () => {
        await fetchSalesCallback()
        if (organizationId) {
          fetchItemsFromStore(organizationId)
        }
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
      setMessage({
        type: 'error',
        text: 'Can only edit sales records for today. Past dates cannot be modified.',
      })
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

    // Show warning if batch is selected (restocking or opening_stock) and quantity exceeds available
    if (selectedBatch) {
      const qty = parseFloat(value) || 0
      if (qty > selectedBatch.available) {
        const batchType =
          selectedBatch.type === 'restocking' ? 'restocked batch' : 'opening stock batch'
        setMessage({
          type: 'error',
          text: `Cannot use more than ${selectedBatch.available} units from this ${batchType}. Available: ${selectedBatch.available}`,
        })
      } else {
        setMessage(null) // Clear error if within limit
      }
    } else {
      setMessage(null) // Clear error if no batch selected
    }

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

      if (!user) {
        setMessage({ type: 'error', text: 'You must be logged in' })
        setLoading(false)
        return
      }

      const response = await fetch(
        `/api/sales/delete?sale_id=${id}&item_id=${saleToDelete.item_id}&quantity=${saleToDelete.quantity}&date=${saleToDelete.date}&user_id=${user.id}`,
        {
          method: 'DELETE',
        }
      )

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete sales record')
      }

      setMessage({ type: 'success', text: 'Sales record deleted successfully!' })

      // Remove sale from store
      removeSale(id)

      // Refresh data from stores
      await fetchSalesCallback()
      if (organizationId) {
        await fetchItemsFromStore(organizationId)
      }
      await fetchOpeningStockCallback()
      await fetchRestockingCallback()
      setSelectedBatch(null)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete sales record'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white shadow rounded-lg p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
        {editingSale ? 'Edit Sales/Usage' : 'Record Sales/Usage'}
      </h2>
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        role="form"
        aria-label={editingSale ? 'Edit sales form' : 'Record sales form'}
      >
        {message && (
          <div
            role="alert"
            aria-live="polite"
            className={`p-3 rounded ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Show warning if tenant admin hasn't selected a branch */}
        {isTenantAdmin && (!branchId || !currentBranch) && (
          <div
            role="alert"
            aria-live="polite"
            className="p-3 sm:p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 mb-4"
          >
            <p className="font-medium text-sm sm:text-base">
              ⚠️ Please select a branch to record sales
            </p>
            <p className="text-xs sm:text-sm mt-1">
              You are viewing data from all branches. To record sales, please select a specific
              branch from the branch selector above.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
            Date{' '}
            {userRole !== 'admin' && userRole !== 'superadmin' && (
              <span className="text-xs text-gray-500">(Today only)</span>
            )}
            {(userRole === 'admin' || userRole === 'superadmin') && (
              <span className="text-xs text-gray-500">(Admin: Can select past dates)</span>
            )}
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={e => {
              const selectedDate = e.target.value
              const today = format(new Date(), 'yyyy-MM-dd')

              if (userRole !== 'admin' && userRole !== 'superadmin' && selectedDate !== today) {
                setMessage({ type: 'error', text: "Sales can only be recorded for today's date." })
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
            disabled={!isAdmin}
            aria-label="Select date for sales record"
            aria-describedby="date-help"
            className={`w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 min-h-[44px] ${
              !isAdmin ? 'bg-gray-50 cursor-not-allowed' : ''
            }`}
            readOnly={!isAdmin}
          />
          <p id="date-help" className="mt-1 text-xs text-gray-500">
            {isAdmin || isSuperAdmin
              ? 'Admins can record sales for past dates to backfill data. Staff can only record for today.'
              : 'Sales can only be recorded for today to avoid confusion'}
          </p>
        </div>

        <div>
          <label htmlFor="item" className="block text-sm font-medium text-gray-700 mb-1">
            Item Used
            {isPastDate && (
              <span className="text-xs text-gray-500 ml-1">(From opening stock of this date)</span>
            )}
          </label>
          <select
            id="item"
            value={selectedItem}
            onChange={e => {
              setSelectedItem(e.target.value)
              setSelectedBatch(null)
              manuallySelectedBatchRef.current = false // Reset manual selection when item changes
              setPricePerUnit('')
              setTotalPrice('')
            }}
            required
            disabled={isTenantAdmin && (!branchId || !currentBranch)}
            aria-label="Select item used"
            aria-describedby="item-help"
            className={`w-full capitalize px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white min-h-[44px] ${
              isTenantAdmin && (!branchId || !currentBranch)
                ? 'bg-gray-50 cursor-not-allowed opacity-50'
                : 'cursor-pointer'
            }`}
          >
            <option value="">Select an item</option>
            {isPastDate ? (
              openingStocks.length > 0 ? (
                openingStocks.map(openingStock => {
                  const item = openingStock.item
                  if (!item) return null

                  const normalizedDate = date.split('T')[0]

                  // Restocking and sales are already filtered by branch_id in the store
                  const itemRestocking = restockings.filter(r => {
                    const restockDate = r.date.split('T')[0]
                    return r.item_id === item.id && restockDate === normalizedDate
                  })
                  const totalRestocking = itemRestocking.reduce(
                    (sum, r) => sum + parseFloat(r.quantity.toString()),
                    0
                  )

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

                  const displayText =
                    totalRestocking > 0
                      ? `${item.name} (${item.unit}) - Available: ${available > 0 ? available : 0} (Opening Stock: ${openingQty}, Restocked: ${totalRestocking})`
                      : `${item.name} (${item.unit}) - Available: ${available > 0 ? available : 0} (Opening Stock: ${openingQty})`

                  return (
                    <option key={item.id} value={item.id} className=" capitalize!">
                      {displayText}
                    </option>
                  )
                })
              ) : (
                <option value="" disabled>
                  No opening stock found for this date. Please record opening stock first.
                </option>
              )
            ) : openingStocks.length > 0 ? (
              // Only show items that have opening stock for this date
              (() => {
                const normalizedDate = normalizeDate(date)

                // Filter opening stocks by date - prefer branch-specific, include NULL as fallback
                const relevantOpeningStocks = openingStocks.filter(os => {
                  const osDate = normalizeDate(os.date)
                  if (branchId) {
                    // Include branch-specific AND NULL branch_id (for fallback)
                    return (
                      osDate === normalizedDate &&
                      (os.branch_id === branchId || os.branch_id === null)
                    )
                  }
                  // Only include NULL branch_id when no branchId is set
                  return osDate === normalizedDate && os.branch_id === null
                })

                // Get unique items from opening stocks - prefer branch-specific over NULL
                const itemMap = new Map<string, (typeof relevantOpeningStocks)[0]>()
                relevantOpeningStocks.forEach(os => {
                  if (!os.item) return
                  const existing = itemMap.get(os.item.id)
                  // Prefer branch-specific over NULL branch_id
                  if (!existing || (os.branch_id === branchId && existing.branch_id !== branchId)) {
                    itemMap.set(os.item.id, os)
                  }
                })

                return Array.from(itemMap.values())
                  .map(openingStock => {
                    const item = openingStock.item
                    if (!item) return null

                    // Use the selected opening stock record (prefers branch-specific if available)
                    // This ensures we show branch-specific quantity (43) when it exists,
                    // but still show items even if only NULL branch_id exists
                    const openingQty = parseFloat(openingStock.quantity.toString())

                    // Restocking from store - prefer branch-specific, fallback to NULL branch_id
                    const branchSpecificRestocking = branchId
                      ? restockings.filter(r => {
                          const restockDate = normalizeDate(r.date)
                          return (
                            r.item_id === item.id &&
                            restockDate === normalizedDate &&
                            r.branch_id === branchId
                          )
                        })
                      : []
                    const nullBranchRestocking =
                      branchSpecificRestocking.length === 0
                        ? restockings.filter(r => {
                            const restockDate = normalizeDate(r.date)
                            return (
                              r.item_id === item.id &&
                              restockDate === normalizedDate &&
                              r.branch_id === null
                            )
                          })
                        : []
                    // Prefer branch-specific restocking, fallback to NULL branch_id (legacy data)
                    const itemRestocking =
                      branchSpecificRestocking.length > 0
                        ? branchSpecificRestocking
                        : nullBranchRestocking
                    const totalRestocking = itemRestocking.reduce(
                      (sum, r) => sum + parseFloat(r.quantity.toString()),
                      0
                    )

                    // Sales from store - prefer branch-specific, fallback to NULL branch_id
                    const branchSpecificSales = branchId
                      ? sales.filter(s => {
                          const saleDate = normalizeDate(s.date)
                          return (
                            s.item_id === item.id &&
                            saleDate === normalizedDate &&
                            s.branch_id === branchId
                          )
                        })
                      : []
                    const nullBranchSales =
                      branchSpecificSales.length === 0
                        ? sales.filter(s => {
                            const saleDate = normalizeDate(s.date)
                            return (
                              s.item_id === item.id &&
                              saleDate === normalizedDate &&
                              s.branch_id === null
                            )
                          })
                        : []
                    // Prefer branch-specific sales, fallback to NULL branch_id (legacy data)
                    const itemSales =
                      branchSpecificSales.length > 0 ? branchSpecificSales : nullBranchSales
                    const totalSales = itemSales.reduce((sum, s) => {
                      if (editingSale && s.id === editingSale.id) return sum
                      return sum + parseFloat(s.quantity.toString())
                    }, 0)

                    // Available stock = Opening + Restocking - Sales
                    // Note: Transfers are included in the detailed StockAvailabilityDisplay component after item selection
                    const available = Math.max(0, openingQty + totalRestocking - totalSales)

                    const displayText =
                      totalRestocking > 0
                        ? `${item.name} (${item.unit}) - Available: ${available > 0 ? available : 0} (Opening Stock: ${openingQty}, Restocked: ${totalRestocking})`
                        : `${item.name} (${item.unit}) - Available: ${available > 0 ? available : 0} (Opening Stock: ${openingQty})`

                    return (
                      <option key={item.id} value={item.id}>
                        {displayText}
                      </option>
                    )
                  })
                  .filter(Boolean) // Remove null entries
              })()
            ) : (
              <option value="" disabled>
                No opening stock found for this date. Please record opening stock first.
              </option>
            )}
          </select>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (organizationId) {
                  await fetchItemsFromStore(organizationId)
                }
                await fetchSalesCallback()
                // Force refresh opening stock to get latest data
                const dateStr = date.includes('T')
                  ? date.split('T')[0]
                  : date.includes('/')
                    ? (() => {
                        const parts = date.split('/')
                        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : date
                      })()
                    : date
                await fetchOpeningStockFromStore(dateStr, organizationId, branchId, true)
                await fetchRestockingCallback()
                setMessage({ type: 'success', text: 'Items list refreshed!' })
                setTimeout(() => setMessage(null), 2000)
              }}
              aria-label="Refresh items list"
              className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-800 underline min-h-[44px] px-2 py-1 cursor-pointer touch-manipulation"
            >
              Refresh Items List
            </button>
            {items.length > 0 && (
              <span id="item-help" className="text-xs text-gray-500">
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

        {selectedItem &&
          (() => {
            // Get all available batches using the helper function
            const allBatches = getAvailableBatches()

            // Update batch availability if it changed (e.g., after new restocking)
            if (allBatches.length > 0 && selectedBatch) {
              const currentBatch = allBatches.find(
                b => b.type === selectedBatch.type && b.id === selectedBatch.id
              )
              if (currentBatch && currentBatch.available !== selectedBatch.available) {
                setSelectedBatch({
                  ...selectedBatch,
                  available: currentBatch.available,
                  label: currentBatch.label,
                })
              }
            }

            // Show batch selector dropdown if multiple batches available
            if (allBatches.length > 1) {
              return (
                <div className="mt-2">
                  <label
                    htmlFor="batch-selector"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    Select Batch (Optional)
                    <span className="text-gray-500 font-normal ml-1">
                      - Auto-selected:{' '}
                      {selectedBatch?.type === 'opening_stock'
                        ? 'Opening Stock'
                        : 'Restocked Batch'}
                    </span>
                  </label>
                  <select
                    id="batch-selector"
                    value={selectedBatch ? `${selectedBatch.type}-${selectedBatch.id}` : ''}
                    onChange={e => {
                      const value = e.target.value
                      // Split only on the first '-' to separate type from UUID (UUIDs contain dashes)
                      const firstDashIndex = value.indexOf('-')
                      if (firstDashIndex === -1) return

                      const type = value.substring(0, firstDashIndex) as
                        | 'opening_stock'
                        | 'restocking'
                      const id = value.substring(firstDashIndex + 1)

                      const batch = allBatches.find(b => b.type === type && b.id === id)
                      if (batch) {
                        manuallySelectedBatchRef.current = true // Mark as manually selected
                        setSelectedBatch({
                          type: batch.type,
                          id: batch.id,
                          price: batch.price,
                          label: batch.label,
                          available: batch.available,
                        })
                        setPricePerUnit(batch.price.toFixed(2))
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white min-h-[44px]"
                  >
                    {allBatches.map(batch => (
                      <option key={`${batch.type}-${batch.id}`} value={`${batch.type}-${batch.id}`}>
                        {batch.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    💡 Tip: Select a different batch if the auto-selected one doesn't have enough
                    quantity
                  </p>
                </div>
              )
            }

            // Show price info if only one batch or batch is selected
            if (selectedBatch) {
              return (
                <div className="mt-1 text-xs text-gray-500">
                  Selling from:{' '}
                  {selectedBatch.type === 'opening_stock' ? 'Opening Stock' : 'Restocked Batch'} -
                  Price: ₦{selectedBatch.price.toFixed(2)}/unit - Available:{' '}
                  {selectedBatch.available}{' '}
                  {items.find(i => i.id === selectedItem)?.unit || 'pieces'}
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
            onChange={e => handleQuantityChange(e.target.value)}
            required
            min="0"
            max={selectedBatch ? selectedBatch.available : undefined}
            aria-label="Quantity used"
            inputMode="numeric"
            className={`w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 min-h-[44px] ${
              selectedBatch && parseFloat(quantity) > selectedBatch.available
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300'
            }`}
            placeholder="0"
          />
          {selectedBatch && (
            <p className="mt-1 text-xs text-amber-600">
              ⚠️ Maximum quantity for this{' '}
              {selectedBatch.type === 'restocking' ? 'restocked' : 'opening stock'} batch:{' '}
              {selectedBatch.available} units
            </p>
          )}
          {selectedItem &&
            (() => {
              const item = items.find(item => item.id === selectedItem)
              if (!item) return null

              return (
                <div className="mt-1 space-y-1">
                  {item.selling_price > 0 && (
                    <p className="text-xs text-gray-500">
                      Default selling price: ₦{item.selling_price.toFixed(2)}/{item.unit} (you can
                      adjust this below)
                    </p>
                  )}
                  <StockAvailabilityDisplay
                    itemId={selectedItem}
                    date={date}
                    sales={sales}
                    editingSale={editingSale}
                    item={item}
                    quantityToRecord={parseFloat(quantity) || 0}
                    organizationId={organizationId}
                    branchId={branchId}
                  />
                </div>
              )
            })()}
        </div>

        <div>
          <label htmlFor="price_per_unit" className="block text-sm font-medium text-gray-700 mb-1">
            Price Per Unit (₦)
            <span className="text-xs text-gray-500 font-normal ml-1">
              (You can adjust this for customer bargaining)
            </span>
          </label>
          <input
            id="price_per_unit"
            type="number"
            step="0.01"
            min="0"
            value={pricePerUnit}
            onChange={e => handlePricePerUnitChange(e.target.value)}
            required
            className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 min-h-[44px]"
            placeholder="0.00"
            aria-label="Price per unit in Nigerian Naira (editable for customer bargaining)"
            inputMode="decimal"
          />
          {selectedItem &&
            (() => {
              const item = items.find(item => item.id === selectedItem)
              return item && item.selling_price > 0 ? (
                <p className="mt-1 text-xs text-gray-500">
                  Default: ₦{item.selling_price.toFixed(2)}/{item.unit} - You can change this price
                  for negotiated sales
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
            onChange={e => setTotalPrice(e.target.value)}
            required
            aria-label="Total price in Nigerian Naira"
            inputMode="decimal"
            className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 bg-gray-50 min-h-[44px]"
            placeholder="0.00"
          />
          <p className="mt-1 text-xs text-gray-500">
            Calculated automatically, but can be edited if needed
          </p>
        </div>

        <div>
          <label htmlFor="payment_mode" className="block text-sm font-medium text-gray-700 mb-1">
            Payment Mode
          </label>
          <select
            id="payment_mode"
            value={paymentMode}
            onChange={e => setPaymentMode(e.target.value as 'cash' | 'transfer')}
            required
            aria-label="Select payment mode"
            className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white cursor-pointer min-h-[44px]"
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
            onChange={e => setDescription(e.target.value)}
            aria-label="Sale description"
            className="w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-gray-400 min-h-[44px]"
            placeholder="Rice, Egusi & Fufu"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="submit"
            disabled={loading || (isTenantAdmin && (!branchId || !currentBranch))}
            aria-label={
              loading ? 'Saving sales record' : editingSale ? 'Update sales record' : 'Record sales'
            }
            className="flex-1 bg-indigo-600 text-white py-3 sm:py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors min-h-[44px] touch-manipulation"
          >
            {loading ? 'Saving...' : editingSale ? 'Update Sales' : 'Record Sales'}
          </button>
          {editingSale && (
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={loading}
              aria-label="Cancel editing sales record"
              className="px-4 py-3 sm:py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors min-h-[44px] touch-manipulation"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="mt-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">
          Recent Sales/Usage Records
        </h3>
        {sales.length > 0 ? (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-3">
              {sales
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map(sale => (
                  <div
                    key={sale.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {sale.item?.name ||
                            (sale.item_id
                              ? `Item ID: ${sale.item_id.substring(0, 8)}...`
                              : 'Unknown')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(sale.date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      {(userRole === 'admin' || userRole === 'superadmin') && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(sale)}
                            aria-label={`Edit sale for ${sale.item?.name}`}
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer touch-manipulation"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(sale.id)}
                            aria-label={`Delete sale for ${sale.item?.name}`}
                            className="text-red-600 hover:text-red-900 text-sm font-medium min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer touch-manipulation"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Quantity:</span>
                        <span className="text-gray-900 font-medium">
                          {sale.quantity} {sale.item?.unit || ''}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Price/Unit:</span>
                        <span className="text-gray-900">₦{sale.price_per_unit.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total:</span>
                        <span className="text-gray-900 font-semibold">
                          ₦{sale.total_price.toFixed(2)}
                        </span>
                      </div>
                      {sale.batch_label && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Batch:</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {sale.batch_label}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment:</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            sale.payment_mode === 'cash'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {sale.payment_mode === 'cash' ? 'Cash' : 'Transfer'}
                        </span>
                      </div>
                      {sale.description && (
                        <div className="pt-1 border-t border-gray-100">
                          <span className="text-gray-600 text-xs">{sale.description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
              <table
                className="min-w-full divide-y divide-gray-200"
                role="table"
                aria-label="Recent sales records"
              >
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-2 sm:px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      Date
                    </th>
                    <th
                      scope="col"
                      className="px-2 sm:px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      Item
                    </th>
                    <th
                      scope="col"
                      className="hidden md:table-cell px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      Batch
                    </th>
                    <th
                      scope="col"
                      className="px-2 sm:px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      Qty
                    </th>
                    <th
                      scope="col"
                      className="hidden lg:table-cell px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      Price/Unit
                    </th>
                    <th
                      scope="col"
                      className="px-2 sm:px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      Total
                    </th>
                    <th
                      scope="col"
                      className="hidden lg:table-cell px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      Payment
                    </th>
                    <th
                      scope="col"
                      className="hidden xl:table-cell px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      Description
                    </th>
                    {(userRole === 'admin' || userRole === 'superadmin') && (
                      <th
                        scope="col"
                        className="px-2 sm:px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase"
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sales
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map(sale => (
                      <tr key={sale.id}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {format(new Date(sale.date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {sale.item?.name ||
                            (sale.item_id
                              ? `Item ID: ${sale.item_id.substring(0, 8)}...`
                              : 'Unknown')}
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
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              sale.payment_mode === 'cash'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
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
            {sales.length > itemsPerPage && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(sales.length / itemsPerPage)}
                totalItems={sales.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">
              No sales records found for {format(new Date(date), 'MMM dd, yyyy')}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Sales recorded for this date will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
