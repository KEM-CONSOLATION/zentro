'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { useAuth } from '@/lib/hooks/useAuth'
import { useBranchStore } from '@/lib/stores/branchStore'

export default function UserManagement() {
  const { organizationId, isTenantAdmin } = useAuth()
  const { availableBranches, fetchBranches } = useBranchStore()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'staff' as 'admin' | 'staff' | 'superadmin',
    branch_id: '' as string | '',
  })
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (organizationId && isTenantAdmin) {
      fetchBranches(organizationId)
    }
  }, [organizationId, isTenantAdmin, fetchBranches])

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .single()

      if (!profile) return

      let query = supabase.from('profiles').select('*')

      // Admins only see staff in their organization (exclude themselves and other admins)
      if (profile.role === 'admin' && profile.organization_id) {
        // Tenant admins see all staff and branch managers in their organization
        // Branch managers see only staff in their branch
        if (!profile.branch_id) {
          // Tenant admin: see all staff and branch managers
          query = query
            .eq('organization_id', profile.organization_id)
            .in('role', ['staff', 'branch_manager'])
            .neq('id', user.id) // Exclude current user
        } else {
          // Branch manager: see only staff in their branch
          query = query
            .eq('organization_id', profile.organization_id)
            .eq('branch_id', profile.branch_id)
            .eq('role', 'staff')
            .neq('id', user.id) // Exclude current user
        }
      } else if (profile.role === 'superadmin') {
        // Superadmins see all users except themselves
        query = query.neq('id', user.id)
      } else {
        // Staff see nothing (they shouldn't access this page, but just in case)
        setUsers([])
        setLoading(false)
        return
      }

      const { data, error: fetchError } = await query.order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setUsers(data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: 'admin' | 'staff' | 'superadmin') => {
    setError(null)
    setSuccess(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('Not authenticated')
        return
      }

      // Prevent self-modification
      if (userId === user.id) {
        setError('You cannot modify your own role')
        return
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (updateError) throw updateError

      setSuccess(`User role updated to ${newRole}`)
      fetchUsers()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update user role')
    }
  }

  const deleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete ${userEmail}? This action cannot be undone.`)) {
      return
    }

    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/users/delete?user_id=${userId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to delete user')

      setSuccess('User deleted successfully')
      fetchUsers()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to delete user')
    }
  }

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setCreating(true)

    try {
      // Prepare user data
      const userData: {
        email: string
        password: string
        fullName: string
        role: 'admin' | 'staff' | 'superadmin' | 'branch_manager'
        branch_id?: string | null
      } = {
        email: newUser.email,
        password: newUser.password,
        fullName: newUser.fullName,
        role:
          newUser.role === 'admin' && !newUser.branch_id
            ? 'tenant_admin'
            : newUser.role === 'admin' && newUser.branch_id
              ? 'branch_manager'
              : newUser.role,
      }

      // Set branch_id based on role
      if (newUser.role === 'tenant_admin' || newUser.role === 'admin') {
        // Tenant admin: no branch_id
        userData.branch_id = null
      } else if (newUser.role === 'branch_manager' || newUser.role === 'staff') {
        // Branch manager and staff: require branch_id
        if (!newUser.branch_id) {
          setError('Branch is required for branch managers and staff')
          setCreating(false)
          return
        }
        userData.branch_id = newUser.branch_id
      }

      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      setSuccess(`User ${newUser.email} created successfully!`)
      setNewUser({ email: '', password: '', fullName: '', role: 'staff', branch_id: '' })
      setShowCreateForm(false)

      await new Promise(resolve => setTimeout(resolve, 1000))
      await fetchUsers()

      setTimeout(() => setSuccess(null), 5000)
    } catch (err: any) {
      setError(err.message || 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">User Management</h2>
          <p className="text-gray-600">Manage user roles and permissions</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer"
        >
          {showCreateForm ? 'Cancel' : '+ Create User'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New User</h3>
          <form onSubmit={createUser} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                id="email"
                type="email"
                value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  minLength={6}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={newUser.fullName}
                onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 placeholder:text-black"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                Role *
              </label>
              <select
                id="role"
                value={newUser.role}
                onChange={e => {
                  const role = e.target.value as 'admin' | 'staff' | 'superadmin' | 'branch_manager'
                  setNewUser({
                    ...newUser,
                    role,
                    // Clear branch_id if role is admin (tenant admin)
                    branch_id: role === 'admin' ? '' : newUser.branch_id,
                  })
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 cursor-pointer"
              >
                <option value="staff">Staff</option>
                <option value="branch_manager">Branch Manager</option>
                {isTenantAdmin && <option value="admin">Tenant Admin</option>}
              </select>
            </div>

            {(newUser.role === 'staff' || newUser.role === 'branch_manager') && (
              <div>
                <label
                  htmlFor="branch_id"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Branch <span className="text-red-500">*</span>
                </label>
                <select
                  id="branch_id"
                  value={newUser.branch_id}
                  onChange={e => setNewUser({ ...newUser, branch_id: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 cursor-pointer"
                >
                  <option value="">Select a branch</option>
                  {availableBranches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {creating ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setNewUser({ email: '', password: '', fullName: '', role: 'staff', branch_id: '' })
                  setError(null)
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Loading users...</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Full Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.full_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'superadmin'
                              ? 'bg-red-100 text-red-800'
                              : user.role === 'admin'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {user.role === 'superadmin' ? (
                            <span className="text-xs text-red-600 font-semibold">Superadmin</span>
                          ) : user.role === 'admin' ? (
                            <button
                              onClick={() => updateUserRole(user.id, 'staff')}
                              className="text-indigo-600 hover:text-indigo-900 cursor-pointer text-xs"
                            >
                              Set as Staff
                            </button>
                          ) : (
                            <button
                              onClick={() => updateUserRole(user.id, 'admin')}
                              className="text-indigo-600 hover:text-indigo-900 cursor-pointer text-xs"
                            >
                              Set as Admin
                            </button>
                          )}
                          {user.role !== 'superadmin' && (
                            <button
                              onClick={() => deleteUser(user.id, user.email)}
                              className="text-red-600 hover:text-red-900 cursor-pointer text-xs ml-2"
                            >
                              Delete
                            </button>
                          )}
                        </div>
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
