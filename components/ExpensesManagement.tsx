'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Expense, Profile } from '@/types/database'
import { format, subDays } from 'date-fns'

export default function ExpensesManagement() {
  const [expenses, setExpenses] = useState<(Expense & { recorded_by_profile?: Profile })[]>([])
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    notes: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  })
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null)
  const [previousDaySales, setPreviousDaySales] = useState(0)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    checkUserRole()
    fetchExpenses()
    fetchPreviousDaySales()
  }, [selectedDate])

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

  const fetchPreviousDaySales = async () => {
    const yesterday = format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd')
    const { data: sales } = await supabase
      .from('sales')
      .select('total_price')
      .eq('date', yesterday)

    const total = sales?.reduce((sum, s) => sum + (s.total_price || 0), 0) || 0
    setPreviousDaySales(total)
  }

  const fetchExpenses = async () => {
    setLoading(true)
    try {
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('*, recorded_by_profile:profiles(*)')
        .eq('date', selectedDate)
        .order('created_at', { ascending: false })

      if (expensesData) {
        setExpenses(expensesData as (Expense & { recorded_by_profile?: Profile })[])
      }
    } catch (error) {
      console.error('Error fetching expenses:', error)
    } finally {
      setLoading(false)
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

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update({
            description: formData.description,
            amount: parseFloat(formData.amount),
            category: formData.category || null,
            notes: formData.notes || null,
            date: formData.date,
          })
          .eq('id', editingExpense.id)

        if (error) throw error
        setMessage({ type: 'success', text: 'Expense updated successfully!' })
        setEditingExpense(null)
      } else {
        const { error } = await supabase.from('expenses').insert({
          description: formData.description,
          amount: parseFloat(formData.amount),
          category: formData.category || null,
          notes: formData.notes || null,
          date: formData.date,
          recorded_by: user.id,
        })

        if (error) throw error
        setMessage({ type: 'success', text: 'Expense recorded successfully!' })
      }

      setFormData({ description: '', amount: '', category: '', notes: '', date: format(new Date(), 'yyyy-MM-dd') })
      fetchExpenses()
      fetchPreviousDaySales()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save expense'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense)
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category || '',
      notes: expense.notes || '',
      date: expense.date,
    })
  }

  const handleCancelEdit = () => {
    setEditingExpense(null)
    setFormData({ description: '', amount: '', category: '', notes: '', date: format(new Date(), 'yyyy-MM-dd') })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return

    setLoading(true)
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
      setMessage({ type: 'success', text: 'Expense deleted successfully!' })
      fetchExpenses()
      fetchPreviousDaySales()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete expense'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const balance = previousDaySales - totalExpenses

  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Expenses Management</h2>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-600 mb-1">Previous Day Sales</p>
          <p className="text-2xl font-bold text-blue-900">₦{previousDaySales.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <p className="text-sm text-red-600 mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-red-900">₦{totalExpenses.toFixed(2)}</p>
        </div>
        <div className={`rounded-lg p-4 border ${balance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-sm mb-1 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>Balance After Expenses</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-900' : 'text-red-900'}`}>
            ₦{balance.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="expense-date" className="block text-sm font-medium text-gray-700 mb-2">
          Select Date
        </label>
        <input
          id="expense-date"
          type="date"
          value={selectedDate}
          onChange={(e) => {
            setSelectedDate(e.target.value)
            setFormData({ ...formData, date: e.target.value })
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-gray-900 cursor-pointer"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <input
              id="description"
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
              placeholder="e.g., Rent, Utilities, Supplies"
            />
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
              Amount (₦) *
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
              placeholder="0.00"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <input
              id="category"
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
              placeholder="e.g., Rent, Utilities"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {loading ? 'Saving...' : editingExpense ? 'Update Expense' : 'Add Expense'}
          </button>
          {editingExpense && (
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

      {expenses.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Expenses for {format(new Date(selectedDate), 'MMM dd, yyyy')}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
                  {userRole === 'admin' && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">{expense.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">₦{expense.amount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{expense.category || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {expense.recorded_by_profile?.full_name || expense.recorded_by_profile?.email}
                    </td>
                    {userRole === 'admin' && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
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

