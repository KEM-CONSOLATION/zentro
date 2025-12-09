import { create } from 'zustand'
import { Item } from '@/types/database'
import { supabase } from '@/lib/supabase/client'

interface ItemsState {
  items: Item[]
  loading: boolean
  error: string | null
  lastFetched: number | null
  fetchItems: (organizationId: string | null, branchId?: string | null) => Promise<void>
  addItem: (item: Item) => void
  updateItem: (itemId: string, updates: Partial<Item>) => void
  removeItem: (itemId: string) => void
  clear: () => void
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export const useItemsStore = create<ItemsState>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  lastFetched: null,

  fetchItems: async (organizationId: string | null, branchId?: string | null) => {
    const state = get()
    const now = Date.now()

    // Return cached data if still fresh
    if (
      state.lastFetched &&
      now - state.lastFetched < CACHE_DURATION &&
      state.items.length > 0 &&
      !state.loading
    ) {
      return
    }

    set({ loading: true, error: null })

    try {
      let itemsQuery = supabase.from('items').select('*').order('name')

      if (organizationId) {
        itemsQuery = itemsQuery.eq('organization_id', organizationId)
      }

      // Filter by branch_id if provided (for branch-specific inventory)
      // If branchId is null/undefined, show all items (tenant admin viewing all branches)
      if (branchId !== undefined && branchId !== null) {
        itemsQuery = itemsQuery.eq('branch_id', branchId)
      }

      const { data, error } = await itemsQuery

      if (error) throw error

      set({
        items: data || [],
        loading: false,
        lastFetched: now,
        error: null,
      })
    } catch (error) {
      console.error('Error fetching items:', error)
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch items',
      })
    }
  },

  addItem: item => {
    set(state => ({
      items: [...state.items, item].sort((a, b) => a.name.localeCompare(b.name)),
      lastFetched: Date.now(),
    }))
  },

  updateItem: (itemId, updates) => {
    set(state => ({
      items: state.items.map(item => (item.id === itemId ? { ...item, ...updates } : item)),
      lastFetched: Date.now(),
    }))
  },

  removeItem: itemId => {
    set(state => ({
      items: state.items.filter(item => item.id !== itemId),
      lastFetched: Date.now(),
    }))
  },

  clear: () => {
    set({
      items: [],
      loading: false,
      error: null,
      lastFetched: null,
    })
  },
}))
