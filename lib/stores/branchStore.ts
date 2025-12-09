import { create } from 'zustand'
import { getSelectedBranchId, setSelectedBranchId, clearSelectedBranchId } from '@/lib/utils/cookies'
import { Branch } from '@/types/database'

interface BranchState {
  currentBranch: Branch | null
  availableBranches: Branch[]
  loading: boolean
  error: string | null
  setCurrentBranch: (branch: Branch | null) => void
  setAvailableBranches: (branches: Branch[]) => void
  fetchBranches: (organizationId: string) => Promise<void>
  clear: () => void
}

export const useBranchStore = create<BranchState>((set, get) => ({
  currentBranch: null,
  availableBranches: [],
  loading: false,
  error: null,

  setCurrentBranch: branch => {
    set({ currentBranch: branch })
    if (branch) {
      setSelectedBranchId(branch.id)
    } else {
      clearSelectedBranchId()
    }
  },

  setAvailableBranches: branches => {
    set({ availableBranches: branches })
  },

  fetchBranches: async organizationId => {
    set({ loading: true, error: null })

    try {
      const { supabase } = await import('@/lib/supabase/client')

      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })

      if (error) throw error

      set({
        availableBranches: data || [],
        loading: false,
        error: null,
      })

      // If no branch is selected, try to restore from cookie or select first branch
      const state = get()
      if (!state.currentBranch && data && data.length > 0) {
        const savedBranchId = getSelectedBranchId()
        const savedBranch = data.find(b => b.id === savedBranchId)
        if (savedBranch) {
          set({ currentBranch: savedBranch })
        } else if (data.length === 1) {
          // Auto-select if only one branch
          set({ currentBranch: data[0] })
        }
      }
    } catch (error) {
      console.error('Error fetching branches:', error)
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch branches',
        availableBranches: [],
      })
    }
  },

  clear: () => {
    set({
      currentBranch: null,
      availableBranches: [],
      loading: false,
      error: null,
    })
    clearSelectedBranchId()
  },
}))

