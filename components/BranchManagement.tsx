'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useBranchStore } from '@/lib/stores/branchStore'
import { Branch } from '@/types/database'

export default function BranchManagement() {
  const { organizationId, isTenantAdmin } = useAuth()
  const { availableBranches, fetchBranches } = useBranchStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
  })

  useEffect(() => {
    if (organizationId) {
      fetchBranches(organizationId)
    }
  }, [organizationId, fetchBranches])

  // Only tenant admins can manage branches
  if (!isTenantAdmin) {
    return (
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <p className="text-gray-500">Only organization administrators can manage branches.</p>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (editingBranch) {
        // Update branch
        const response = await fetch('/api/branches/update', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branch_id: editingBranch.id,
            organization_id: organizationId,
            name: formData.name,
            address: formData.address || null,
            phone: formData.phone || null,
          }),
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Failed to update branch')

        setSuccess('Branch updated successfully')
        setEditingBranch(null)
      } else {
        // Create branch
        const response = await fetch('/api/branches/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: organizationId,
            name: formData.name,
            address: formData.address || null,
            phone: formData.phone || null,
          }),
        })

        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Failed to create branch')

        setSuccess('Branch created successfully')
        setShowCreateForm(false)
      }

      setFormData({ name: '', address: '', phone: '' })
      if (organizationId) {
        await fetchBranches(organizationId)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save branch')
    } finally {
      setLoading(false)
      setTimeout(() => {
        setSuccess(null)
        setError(null)
      }, 3000)
    }
  }

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch)
    setFormData({
      name: branch.name,
      address: branch.address || '',
      phone: branch.phone || '',
    })
    setShowCreateForm(true)
  }

  const handleDelete = async (branchId: string, branchName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${branchName}"? This will set branch_id to NULL for all associated records. This action cannot be undone.`
      )
    ) {
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/branches/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branchId,
          organization_id: organizationId,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to delete branch')

      setSuccess('Branch deleted successfully')
      if (organizationId) {
        await fetchBranches(organizationId)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete branch')
    } finally {
      setLoading(false)
      setTimeout(() => {
        setSuccess(null)
        setError(null)
      }, 3000)
    }
  }

  const handleCancel = () => {
    setShowCreateForm(false)
    setEditingBranch(null)
    setFormData({ name: '', address: '', phone: '' })
  }

  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Branch Management</h2>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Create Branch
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-800 border border-red-200 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-800 border border-green-200 rounded">
          {success}
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">
            {editingBranch ? 'Edit Branch' : 'Create New Branch'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Saving...' : editingBranch ? 'Update Branch' : 'Create Branch'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Address
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {availableBranches.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No branches found. Create your first branch to get started.
                </td>
              </tr>
            ) : (
              availableBranches.map(branch => (
                <tr key={branch.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {branch.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{branch.address || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {branch.phone || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(branch.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(branch)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4 cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(branch.id, branch.name)}
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
  )
}

