'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useBranchStore } from '@/lib/stores/branchStore'
import { useEffect } from 'react'

export default function BranchSelector() {
  const { isTenantAdmin, organizationId, profile } = useAuth()
  const { currentBranch, availableBranches, setCurrentBranch, fetchBranches, loading } = useBranchStore()

  useEffect(() => {
    if (isTenantAdmin && organizationId) {
      fetchBranches(organizationId)
    }
  }, [isTenantAdmin, organizationId, fetchBranches])

  // Only show for tenant admin (admin without fixed branch_id)
  if (!isTenantAdmin) {
    return null
  }

  // If no branches available, don't show selector
  if (availableBranches.length === 0 && !loading) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="branch-selector" className="text-sm font-medium text-gray-700 whitespace-nowrap">
        Branch:
      </label>
      <select
        id="branch-selector"
        value={currentBranch?.id || ''}
        onChange={(e) => {
          const branch = availableBranches.find(b => b.id === e.target.value)
          setCurrentBranch(branch || null)
        }}
        className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm text-gray-900 bg-white cursor-pointer"
        disabled={loading}
      >
        <option value="">All Branches</option>
        {availableBranches.map(branch => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
      {loading && (
        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
      )}
    </div>
  )
}

