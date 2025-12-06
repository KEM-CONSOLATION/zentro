'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Item, WasteSpoilage, Profile } from '@/types/database'
import { format } from 'date-fns'

export default function WasteSpoilageForm() {
  const [items, setItems] = useState<Item[]>([])
  const [wasteSpoilage, setWasteSpoilage] = useState<(WasteSpoilage & { item?: Item; recorded_by_profile?: Profile })[]>([])
  const [selectedItem, setSelectedItem] = useState('')
  const [quantity, setQuantity] = useState('')
  const [type, setType] = useState<'waste' | 'spoilage'>('waste')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingRecord, setEditingRecord] = useState<WasteSpoilage | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'staff' | 'superadmin' | null>(null)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    fetchItems()
    fetchWasteSpoilage()
    checkUserRole()
    // Ensure date is always today
    setDate(today)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (date !== today) {
      setDate(today)
    }
  }, [date, today])

  useEffect(() => {
    fetchWasteSpoilage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

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

  const fetchWasteSpoilage = async () => {
    const { data, error } = await supabase
      .from('waste_spoilage')
      .select(`
        *,
        item:items(*),
        recorded_by_profile:profiles(*)
      `)
      .eq('date', date)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setWasteSpoilage(data)
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

      // Restrict to today only
      if (date !== today) {
        setMessage({
          type: 'error',
          text: 'Waste/spoilage can only be recorded for today\'s date to avoid confusion.',
        })
        setDate(today)
        setLoading(false)
        return
      }

      if (selectedItem && quantity) {
        const quantityValue = parseFloat(quantity)
        if (quantityValue <= 0) {
          setMessage({ type: 'error', text: 'Quantity must be greater than 0' })
          setLoading(false)
          return
        }

        if (editingRecord) {
          const { error } = await supabase
            .from('waste_spoilage')
            .update({
              item_id: selectedItem,
              quantity: quantityValue,
              type,
              reason: reason || null,
              notes: notes || null,
              date,
            })
            .eq('id', editingRecord.id)

          if (error) throw error
          setMessage({ type: 'success', text: 'Waste/spoilage record updated successfully!' })
          setEditingRecord(null)
        } else {
          const { error } = await supabase.from('waste_spoilage').insert({
            item_id: selectedItem,
            quantity: quantityValue,
            type,
            reason: reason || null,
            notes: notes || null,
            date,
            recorded_by: user.id,
          })

          if (error) throw error
          setMessage({ type: 'success', text: 'Waste/spoilage recorded successfully!' })
        }

        setSelectedItem('')
        setQuantity('')
        setReason('')
        setNotes('')
        setType('waste')
        await fetchWasteSpoilage()
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to record waste/spoilage'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (record: WasteSpoilage) => {
    // Only allow editing today's records
    if (record.date !== today) {
      setMessage({
        type: 'error',
        text: 'You can only edit waste/spoilage records for today.',
      })
      return
    }

    setEditingRecord(record)
    setSelectedItem(record.item_id)
    setQuantity(record.quantity.toString())
    setType(record.type)
    setReason(record.reason || '')
    setNotes(record.notes || '')
    setDate(record.date)
  }

  const handleDelete = async (id: string, recordDate: string) => {
    // Only allow deleting today's records
    if (recordDate !== today) {
      setMessage({
        type: 'error',
        text: 'You can only delete waste/spoilage records for today.',
      })
      return
    }

    if (!confirm('Are you sure you want to delete this waste/spoilage record?')) return

    setLoading(true)
    try {
      const { error } = await supabase.from('waste_spoilage').delete().eq('id', id)

      if (error) throw error
      setMessage({ type: 'success', text: 'Waste/spoilage record deleted successfully!' })
      await fetchWasteSpoilage()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete waste/spoilage record'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditingRecord(null)
    setSelectedItem('')
    setQuantity('')
    setReason('')
    setNotes('')
    setType('waste')
    setDate(today)
  }

  const selectedItemData = items.find((item) => item.id === selectedItem)

  return (
    <div>
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {editingRecord ? 'Edit Waste/Spoilage Record' : 'Record Waste/Spoilage'}
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
              disabled={true}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 cursor-not-allowed bg-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500">Waste/spoilage can only be recorded for today (Today only)</p>
          </div>

          <div>
            <label htmlFor="item" className="block text-sm font-medium text-gray-700 mb-1">
              Item *
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
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Type *
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as 'waste' | 'spoilage')}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 cursor-pointer"
            >
              <option value="waste">Waste</option>
              <option value="spoilage">Spoilage</option>
            </select>
          </div>

          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
              Quantity *
            </label>
            <div className="flex items-center gap-2">
              <input
                id="quantity"
                type="number"
                step="0.01"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                placeholder="0.00"
              />
              {selectedItemData && (
                <span className="text-sm text-gray-500 whitespace-nowrap">{selectedItemData.unit}</span>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason (optional)
            </label>
            <input
              id="reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
              placeholder="e.g., Expired, Damaged, Overcooked"
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
              placeholder="Additional details..."
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {loading ? 'Saving...' : editingRecord ? 'Update Record' : 'Record Waste/Spoilage'}
            </button>
            {editingRecord && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {wasteSpoilage.length > 0 && (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">
              Waste/Spoilage Records for {format(new Date(date), 'MMM dd, yyyy')}
            </h3>
          </div>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recorded By
                  </th>
                  {(userRole === 'admin' || userRole === 'superadmin' || date === today) && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {wasteSpoilage.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {record.item?.name || 'Unknown Item'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          record.type === 'waste'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {record.type === 'waste' ? 'Waste' : 'Spoilage'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.quantity} {record.item?.unit || ''}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{record.reason || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.recorded_by_profile?.full_name || record.recorded_by_profile?.email || 'Unknown'}
                    </td>
                    {(userRole === 'admin' || userRole === 'superadmin' || record.date === today) && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {record.date === today && (
                          <button
                            onClick={() => handleEdit(record)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4 cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                        {record.date === today && (
                          <button
                            onClick={() => handleDelete(record.id, record.date)}
                            className="text-red-600 hover:text-red-900 cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
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

