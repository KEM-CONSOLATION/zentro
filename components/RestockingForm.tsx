'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Item, Restocking, Profile } from '@/types/database'
import { format } from 'date-fns'
import { useAuth } from '@/lib/hooks/useAuth'
import Pagination from './Pagination'

export default function RestockingForm() {
  const { organizationId, branchId, isAdmin, isSuperAdmin, profile, isTenantAdmin, currentBranch } =
    useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [restockings, setRestockings] = useState<
    (Restocking & { item?: Item; recorded_by_profile?: Profile })[]
  >([])
  const [selectedItem, setSelectedItem] = useState('')
  const [quantity, setQuantity] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingRestocking, setEditingRestocking] = useState<Restocking | null>(null)
  const [userRole, setUserRole] = useState<
    'admin' | 'staff' | 'superadmin' | 'branch_manager' | null
  >(null)
  const [openingStock, setOpeningStock] = useState<number | null>(null)
  const [currentTotal, setCurrentTotal] = useState<number | null>(null)
  const [filterDate, setFilterDate] = useState<string>('') // Date filter for records table
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10 // Reduced to show pagination more readily

  const fetchRestockings = useCallback(async () => {
    let restockingQuery = supabase.from('restocking').select(`
        *,
        item:items(*),
        recorded_by_profile:profiles(*)
      `)

    // Filter by organization_id
    if (organizationId) {
      restockingQuery = restockingQuery.eq('organization_id', organizationId)
    }

    // Filter by branch_id if provided
    if (branchId) {
      restockingQuery = restockingQuery.eq('branch_id', branchId)
    }

    // Filter by date if filterDate is set
    if (filterDate) {
      // Normalize date format
      let normalizedDate = filterDate
      if (filterDate.includes('T')) {
        normalizedDate = filterDate.split('T')[0]
      } else if (filterDate.includes('/')) {
        const parts = filterDate.split('/')
        if (parts.length === 3) {
          // DD/MM/YYYY to YYYY-MM-DD
          normalizedDate = `${parts[2]}-${parts[1]}-${parts[0]}`
        }
      }
      restockingQuery = restockingQuery.eq('date', normalizedDate)
    }

    const { data, error } = await restockingQuery
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && data) {
      setRestockings(data)
    }
  }, [filterDate, organizationId, branchId])

  useEffect(() => {
    fetchItems()
    fetchRestockings()
    checkUserRole()
    // Ensure date is always today for branch managers, but allow past dates for admins
    const today = format(new Date(), 'yyyy-MM-dd')
    if (!isAdmin) {
      setDate(today)
    }
  }, [userRole, fetchRestockings, isAdmin])

  useEffect(() => {
    if (selectedItem && date) {
      fetchOpeningStockAndTotal()
      // Load current prices when item is selected
      const item = items.find(i => i.id === selectedItem)
      if (item) {
        if (!editingRestocking) {
          // Only set prices if not editing (preserve edited prices)
          setCostPrice(item.cost_price.toString())
          setSellingPrice(item.selling_price.toString())
        }
      }
    } else {
      setOpeningStock(null)
      setCurrentTotal(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem, date, items])

  const checkUserRole = async () => {
    // Use profile from useAuth hook if available, otherwise fetch
    if (profile?.role) {
      setUserRole(profile.role as 'admin' | 'staff' | 'superadmin' | 'branch_manager')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profileData) {
        setUserRole(profileData.role as 'admin' | 'staff' | 'superadmin' | 'branch_manager')
      }
    }
  }

  const fetchItems = async () => {
    let itemsQuery = supabase.from('items').select('*').order('name')
    if (organizationId) {
      itemsQuery = itemsQuery.eq('organization_id', organizationId)
    }
    // Note: Items are organization-level, not branch-level, so we don't filter by branch_id
    const { data } = await itemsQuery
    if (data) {
      setItems(data)
    }
  }

  const fetchOpeningStockAndTotal = async () => {
    try {
      // Get opening stock for the selected date
      let openingQuery = supabase
        .from('opening_stock')
        .select('quantity')
        .eq('item_id', selectedItem)
        .eq('date', date)
      if (organizationId) {
        openingQuery = openingQuery.eq('organization_id', organizationId)
      }
      if (branchId) {
        openingQuery = openingQuery.eq('branch_id', branchId)
      }
      const { data: openingData } = await openingQuery.single()

      const openingQty = openingData?.quantity || 0

      // Get total restocking for the date
      let restockingQuery = supabase
        .from('restocking')
        .select('quantity')
        .eq('item_id', selectedItem)
        .eq('date', date)
      if (organizationId) {
        restockingQuery = restockingQuery.eq('organization_id', organizationId)
      }
      if (branchId) {
        restockingQuery = restockingQuery.eq('branch_id', branchId)
      }
      const { data: restockingData } = await restockingQuery

      const totalRestocking =
        restockingData?.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0) || 0

      // Get total sales for the date
      let salesQuery = supabase
        .from('sales')
        .select('quantity')
        .eq('item_id', selectedItem)
        .eq('date', date)
      if (organizationId) {
        salesQuery = salesQuery.eq('organization_id', organizationId)
      }
      if (branchId) {
        salesQuery = salesQuery.eq('branch_id', branchId)
      }
      const { data: salesData } = await salesQuery

      const totalSales =
        salesData?.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0) || 0

      // Current total = opening stock + restocking - sales
      const current = openingQty + totalRestocking - totalSales

      setOpeningStock(openingQty)
      setCurrentTotal(current)
    } catch {
      // Fallback to 0 if calculation fails
      setOpeningStock(0)
      setCurrentTotal(0)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // Tenant admins must have a branch selected to record restocking
    if (isTenantAdmin && (!branchId || !currentBranch)) {
      setMessage({
        type: 'error',
        text: 'Please select a branch from the branch selector above to record restocking.',
      })
      setLoading(false)
      return
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      // Superadmins cannot perform restocking operations
      if (isSuperAdmin) {
        setMessage({
          type: 'error',
          text: 'Superadmins cannot perform restocking operations. Please contact the organization admin.',
        })
        setLoading(false)
        return
      }

      // Staff cannot perform restocking operations - only managers and admins can
      const userRole = profile?.role || null
      if (userRole === 'staff') {
        setMessage({
          type: 'error',
          text: 'Staff cannot record restocking. Only managers and admins can perform restocking operations.',
        })
        setLoading(false)
        return
      }

      // Restrict restocking to today only for branch managers, allow past dates for admins
      const today = format(new Date(), 'yyyy-MM-dd')
      if (!isAdmin && date !== today) {
        setMessage({
          type: 'error',
          text: "Restocking can only be recorded for today's date. Please use today's date.",
        })
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
        setMessage({
          type: 'error',
          text: 'Cannot restock: Current stock is negative. Please check your opening stock and sales records.',
        })
        setLoading(false)
        return
      }

      // Update item prices if provided (for future reference)
      // BUT: Do NOT update opening stock prices - past records keep their original prices
      // Price changes only take effect on next day's opening stock (via auto-create-opening API)
      if (costPrice || sellingPrice) {
        const updateData: { cost_price?: number; selling_price?: number } = {}

        if (costPrice) {
          const costPriceValue = parseFloat(costPrice)
          if (!isNaN(costPriceValue) && costPriceValue >= 0) {
            updateData.cost_price = costPriceValue
          }
        }

        if (sellingPrice) {
          const sellingPriceValue = parseFloat(sellingPrice)
          if (!isNaN(sellingPriceValue) && sellingPriceValue >= 0) {
            updateData.selling_price = sellingPriceValue
          }
        }

        if (Object.keys(updateData).length > 0) {
          // Update item prices (for future reference, but doesn't affect past records)
          const { error: itemPriceError } = await supabase
            .from('items')
            .update(updateData)
            .eq('id', selectedItem)

          if (itemPriceError) {
            console.error('Failed to update item prices:', itemPriceError)
            // Don't throw - restocking can still succeed even if price update fails
          }
        }
      }

      // Create opening stock if it doesn't exist (for quantity tracking)
      // But we don't set prices on it - prices come from previous day's opening stock or item
      // This ensures past records keep their original prices
      const { data: existingOpeningStock } = await supabase
        .from('opening_stock')
        .select('id, cost_price, selling_price')
        .eq('item_id', selectedItem)
        .eq('date', date)
        .limit(1)

      if (!existingOpeningStock || existingOpeningStock.length === 0) {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()
        if (currentUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', currentUser.id)
            .single()

          // Get previous day's opening stock to preserve prices
          const prevDate = new Date(date + 'T00:00:00')
          prevDate.setDate(prevDate.getDate() - 1)
          const prevDateStr = prevDate.toISOString().split('T')[0]

          let prevOpeningStockQuery = supabase
            .from('opening_stock')
            .select('cost_price, selling_price')
            .eq('item_id', selectedItem)
            .eq('date', prevDateStr)
            .limit(1)
          if (profile?.organization_id) {
            prevOpeningStockQuery = prevOpeningStockQuery.eq(
              'organization_id',
              profile.organization_id
            )
          }
          if (branchId) {
            prevOpeningStockQuery = prevOpeningStockQuery.eq('branch_id', branchId)
          }
          const { data: prevOpeningStock } = await prevOpeningStockQuery

          // Get item to use as fallback if no previous opening stock
          const { data: item } = await supabase
            .from('items')
            .select('cost_price, selling_price')
            .eq('id', selectedItem)
            .single()

          // Get branch_id: use provided branchId, or get main branch for organization
          let finalBranchId = branchId
          if (!finalBranchId && profile?.organization_id) {
            // If no branchId, get organization's main branch
            const { data: mainBranch } = await supabase
              .from('branches')
              .select('id')
              .eq('organization_id', profile.organization_id)
              .eq('is_active', true)
              .order('created_at', { ascending: true })
              .limit(1)
              .single()

            finalBranchId = mainBranch?.id || null
          }

          // Create opening stock with quantity 0 (if it doesn't exist)
          // Use previous day's opening stock prices, or item's prices as fallback
          // Do NOT use restocking prices - they only affect the next day
          const openingStockData: {
            item_id: string
            quantity: number
            date: string
            recorded_by: string
            notes: string
            organization_id?: string | null
            branch_id?: string | null
            cost_price?: number | null
            selling_price?: number | null
          } = {
            item_id: selectedItem,
            quantity: 0,
            date,
            recorded_by: currentUser.id,
            notes: 'Auto-created from restocking',
            organization_id: profile?.organization_id || null,
            branch_id: finalBranchId,
          }

          // Use previous day's prices if available, otherwise item's prices
          // This preserves price history and prevents restocking from affecting current date
          if (prevOpeningStock && prevOpeningStock.length > 0) {
            openingStockData.cost_price = prevOpeningStock[0].cost_price ?? null
            openingStockData.selling_price = prevOpeningStock[0].selling_price ?? null
          } else if (item) {
            openingStockData.cost_price = item.cost_price ?? null
            openingStockData.selling_price = item.selling_price ?? null
          }

          // Check if opening stock already exists for this item/date/org combination
          // The unique constraint is (item_id, date, organization_id), so we need to check manually
          const { data: existingOpeningStock } = await supabase
            .from('opening_stock')
            .select('id')
            .eq('item_id', selectedItem)
            .eq('date', date)
            .eq('organization_id', profile?.organization_id || '')
            .maybeSingle()

          let createOpeningStockError = null
          if (existingOpeningStock) {
            // Update existing record (preserve quantity, update branch_id if needed)
            const { error: updateError } = await supabase
              .from('opening_stock')
              .update({
                branch_id: finalBranchId,
                cost_price: openingStockData.cost_price,
                selling_price: openingStockData.selling_price,
              })
              .eq('id', existingOpeningStock.id)
            createOpeningStockError = updateError
          } else {
            // Insert new record
            const { error: insertError } = await supabase
              .from('opening_stock')
              .insert(openingStockData)
            createOpeningStockError = insertError
          }

          if (createOpeningStockError) {
            console.error('Failed to create opening stock:', createOpeningStockError)
            // Don't throw - restocking can still succeed
          }
        }
      } else {
        // Opening stock already exists - ensure we don't update its prices
        // Prices should remain as they were originally set
        // This prevents restocking from affecting existing opening stock prices
      }

      // Prepare price data for restocking record
      const restockingPriceData: { cost_price?: number | null; selling_price?: number | null } = {}
      if (costPrice) {
        const costPriceValue = parseFloat(costPrice)
        if (!isNaN(costPriceValue) && costPriceValue >= 0) {
          restockingPriceData.cost_price = costPriceValue
        }
      }
      if (sellingPrice) {
        const sellingPriceValue = parseFloat(sellingPrice)
        if (!isNaN(sellingPriceValue) && sellingPriceValue >= 0) {
          restockingPriceData.selling_price = sellingPriceValue
        }
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
            ...restockingPriceData,
          })
          .eq('id', editingRestocking.id)

        if (error) throw error
        setMessage({ type: 'success', text: 'Restocking updated successfully!' })
        setEditingRestocking(null)
      } else {
        // Get user's organization_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single()

        // Create new restocking
        const { error } = await supabase.from('restocking').insert({
          item_id: selectedItem,
          quantity: quantityValue,
          date,
          recorded_by: user.id,
          organization_id: profile?.organization_id || null,
          branch_id: branchId || null,
          notes: notes || null,
          ...restockingPriceData,
        })

        if (error) throw error
        setMessage({ type: 'success', text: 'Restocking recorded successfully!' })
      }

      setQuantity('')
      setCostPrice('')
      setSellingPrice('')
      setNotes('')
      setSelectedItem('')
      setDate(format(new Date(), 'yyyy-MM-dd'))
      fetchItems() // Refresh items to get updated prices
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
    // Superadmins cannot edit restocking
    if (isSuperAdmin) {
      setMessage({ type: 'error', text: 'Superadmins cannot edit restocking records.' })
      return
    }

    // Staff cannot edit restocking
    if (profile?.role === 'staff') {
      setMessage({ type: 'error', text: 'Staff cannot edit restocking records.' })
      return
    }

    // Only allow editing today's restocking for branch managers, but allow past dates for admins
    if (!isAdmin && restocking.date !== today) {
      setMessage({
        type: 'error',
        text: 'Can only edit restocking records for today. Past dates cannot be modified.',
      })
      return
    }
    setEditingRestocking(restocking)
    setSelectedItem(restocking.item_id)
    setQuantity(restocking.quantity.toString())
    setDate(restocking.date) // Use the restocking's date (allows past dates for admins)
    setNotes(restocking.notes || '')
    // Load prices from restocking record if available, otherwise from item
    if (restocking.cost_price !== null && restocking.cost_price !== undefined) {
      setCostPrice(restocking.cost_price.toString())
    } else {
      const item = items.find(i => i.id === restocking.item_id)
      if (item) setCostPrice(item.cost_price.toString())
    }
    if (restocking.selling_price !== null && restocking.selling_price !== undefined) {
      setSellingPrice(restocking.selling_price.toString())
    } else {
      const item = items.find(i => i.id === restocking.item_id)
      if (item) setSellingPrice(item.selling_price.toString())
    }
  }

  const handleCancelEdit = () => {
    setEditingRestocking(null)
    setQuantity('')
    setCostPrice('')
    setSellingPrice('')
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

  // Block staff from accessing restocking form
  if (profile?.role === 'staff') {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          <p className="font-medium">Access Restricted</p>
          <p className="text-sm mt-1">
            Staff members cannot record restocking. Only managers and admins can perform restocking
            operations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
        {editingRestocking ? 'Edit Restocking' : 'Restock Items'}
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Add quantity to items. This will be added to the opening stock for calculations.
      </p>
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        role="form"
        aria-label={editingRestocking ? 'Edit restocking form' : 'Restock items form'}
      >
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

        {/* Show warning if tenant admin hasn't selected a branch */}
        {isTenantAdmin && (!branchId || !currentBranch) && (
          <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 mb-4">
            <p className="font-medium">⚠️ Please select a branch to record restocking</p>
            <p className="text-sm mt-1">
              You are viewing data from all branches. To record restocking, please select a specific
              branch from the branch selector above.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
            Date {!isAdmin && <span className="text-xs text-gray-500">(Today only)</span>}
            {isAdmin && (
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

              // Branch managers can only use today's date
              if (!isAdmin && selectedDate !== today) {
                setMessage({
                  type: 'error',
                  text: "Restocking can only be recorded for today's date.",
                })
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
            disabled={!isAdmin}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 ${
              !isAdmin ? 'bg-gray-50 cursor-not-allowed' : ''
            }`}
            readOnly={!isAdmin}
          />
          <p className="mt-1 text-xs text-gray-500">
            {isAdmin
              ? 'Admins can record restocking for past dates to backfill data. Branch managers can only record for today.'
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
            onChange={e => setSelectedItem(e.target.value)}
            required
            disabled={isTenantAdmin && (!branchId || !currentBranch)}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 ${
              isTenantAdmin && (!branchId || !currentBranch)
                ? 'bg-gray-50 cursor-not-allowed opacity-50'
                : 'cursor-pointer'
            }`}
          >
            <option value="">Select an item</option>
            {items.map(item => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.unit})
              </option>
            ))}
          </select>
          {selectedItem && openingStock !== null && (
            <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
              <p>
                Opening Stock: <span className="font-medium">{openingStock}</span>{' '}
                {items.find(item => item.id === selectedItem)?.unit || ''}
              </p>
              {currentTotal !== null && (
                <p className="mt-1">
                  Current Total (after restocks & sales):{' '}
                  <span className="font-medium">{currentTotal.toFixed(2)}</span>{' '}
                  {items.find(item => item.id === selectedItem)?.unit || ''}
                </p>
              )}
              {selectedItem &&
                (() => {
                  const item = items.find(i => i.id === selectedItem)
                  return item ? (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p>
                        Current Cost Price:{' '}
                        <span className="font-medium">₦{item.cost_price.toFixed(2)}</span>
                      </p>
                      <p className="mt-1">
                        Current Selling Price:{' '}
                        <span className="font-medium">₦{item.selling_price.toFixed(2)}</span>
                      </p>
                    </div>
                  ) : null
                })()}
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
            onChange={e => setQuantity(e.target.value)}
            required
            min="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
            placeholder="0.00"
          />
          <p className="mt-1 text-xs text-gray-500">
            Enter the quantity to add to the opening stock
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="cost_price" className="block text-sm font-medium text-gray-700 mb-1">
              Cost Price (₦){' '}
              <span className="text-xs text-gray-500">(Optional - updates item price)</span>
            </label>
            <input
              id="cost_price"
              type="number"
              step="0.01"
              min="0"
              value={costPrice}
              onChange={e => setCostPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
              placeholder="0.00"
            />
            <p className="mt-1 text-xs text-gray-500">Leave empty to keep current price</p>
          </div>
          <div>
            <label htmlFor="selling_price" className="block text-sm font-medium text-gray-700 mb-1">
              Selling Price (₦){' '}
              <span className="text-xs text-gray-500">(Optional - updates item price)</span>
            </label>
            <input
              id="selling_price"
              type="number"
              step="0.01"
              min="0"
              value={sellingPrice}
              onChange={e => setSellingPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
              placeholder="0.00"
            />
            <p className="mt-1 text-xs text-gray-500">Leave empty to keep current price</p>
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
            placeholder="Any additional notes..."
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || (isTenantAdmin && (!branchId || !currentBranch))}
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

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Recent Restocking Records</h3>
          <div className="flex items-center gap-2">
            <label htmlFor="filterDate" className="text-sm text-gray-600 whitespace-nowrap">
              Filter by Date:
            </label>
            <input
              type="date"
              id="filterDate"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="px-3 py-1.5 border  text-gray-900 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {filterDate && (
              <button
                type="button"
                onClick={() => setFilterDate('')}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {restockings.length > 0 ? (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Item
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Quantity Added
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Cost Price (₦)
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Selling Price (₦)
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Recorded By
                  </th>
                  {isAdmin && (
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {restockings
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map(restocking => (
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
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {restocking.cost_price !== null && restocking.cost_price !== undefined
                          ? `₦${restocking.cost_price.toFixed(2)}`
                          : restocking.item?.cost_price
                            ? `₦${restocking.item.cost_price.toFixed(2)}`
                            : '-'}
                        {restocking.cost_price !== null &&
                          restocking.cost_price !== undefined &&
                          restocking.item &&
                          restocking.cost_price !== restocking.item.cost_price && (
                            <span
                              className="ml-1 text-xs text-green-600"
                              title="Price updated during restocking"
                            >
                              ●
                            </span>
                          )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {restocking.selling_price !== null && restocking.selling_price !== undefined
                          ? `₦${restocking.selling_price.toFixed(2)}`
                          : restocking.item?.selling_price
                            ? `₦${restocking.item.selling_price.toFixed(2)}`
                            : '-'}
                        {restocking.selling_price !== null &&
                          restocking.selling_price !== undefined &&
                          restocking.item &&
                          restocking.selling_price !== restocking.item.selling_price && (
                            <span
                              className="ml-1 text-xs text-green-600"
                              title="Price updated during restocking"
                            >
                              ●
                            </span>
                          )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        {restocking.recorded_by_profile?.full_name ||
                          restocking.recorded_by_profile?.email ||
                          'Unknown'}
                      </td>
                      {isAdmin && (
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
        ) : (
          <div className="text-center py-8 text-gray-500">
            {filterDate
              ? `No restocking records found for ${format(new Date(filterDate), 'MMM dd, yyyy')}`
              : 'No restocking records found'}
          </div>
        )}
        {restockings.length > itemsPerPage && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(restockings.length / itemsPerPage)}
            totalItems={restockings.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  )
}
