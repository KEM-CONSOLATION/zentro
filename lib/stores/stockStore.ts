import { create } from 'zustand'
import { OpeningStock, ClosingStock, Restocking, Item } from '@/types/database'
import { supabase } from '@/lib/supabase/client'

interface StockState {
  openingStocks: (OpeningStock & { item?: Item })[]
  closingStocks: (ClosingStock & { item?: Item })[]
  restockings: (Restocking & { item?: Item })[]
  loading: {
    opening: boolean
    closing: boolean
    restocking: boolean
  }
  error: string | null
  lastFetched: {
    opening: number | null
    closing: number | null
    restocking: number | null
  }
  lastFetchedDate: {
    opening: string | null
    closing: string | null
    restocking: string | null
  }
  fetchOpeningStock: (
    date: string,
    organizationId: string | null,
    branchId?: string | null,
    forceRefresh?: boolean
  ) => Promise<void>
  fetchClosingStock: (
    date: string,
    organizationId: string | null,
    branchId?: string | null
  ) => Promise<void>
  fetchRestocking: (
    date: string,
    organizationId: string | null,
    branchId?: string | null
  ) => Promise<void>
  addOpeningStock: (stock: OpeningStock & { item?: Item }) => void
  updateOpeningStock: (stockId: string, updates: Partial<OpeningStock>) => void
  addClosingStock: (stock: ClosingStock & { item?: Item }) => void
  updateClosingStock: (stockId: string, updates: Partial<ClosingStock>) => void
  addRestocking: (restocking: Restocking & { item?: Item }) => void
  updateRestocking: (restockingId: string, updates: Partial<Restocking>) => void
  removeRestocking: (restockingId: string) => void
  clear: () => void
}

const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes

export const useStockStore = create<StockState>((set, get) => ({
  openingStocks: [],
  closingStocks: [],
  restockings: [],
  loading: {
    opening: false,
    closing: false,
    restocking: false,
  },
  error: null,
  lastFetched: {
    opening: null,
    closing: null,
    restocking: null,
  },
  lastFetchedDate: {
    opening: null,
    closing: null,
    restocking: null,
  },

  fetchOpeningStock: async (
    date: string,
    organizationId: string | null,
    branchId?: string | null,
    forceRefresh?: boolean
  ) => {
    const state = get()
    const now = Date.now()

    // Return cached data if still fresh and same date (unless force refresh)
    if (
      !forceRefresh &&
      state.lastFetched.opening &&
      state.lastFetchedDate.opening === date &&
      now - state.lastFetched.opening < CACHE_DURATION &&
      !state.loading.opening
    ) {
      return
    }

    set(prev => ({
      loading: { ...prev.loading, opening: true },
      error: null,
    }))

    try {
      let query = supabase
        .from('opening_stock')
        .select(
          `
          *,
          item:items(*)
        `
        )
        .eq('date', date)
        .order('created_at', { ascending: false })

      if (organizationId) {
        query = query.eq('organization_id', organizationId)
      }

      // Filter by branch_id if provided
      // Match the report API behavior: strict branch filtering when branchId is set
      // Include both branch-specific AND NULL branch_id records when branchId exists
      // This allows fallback to NULL records if branch-specific doesn't exist
      // Components will prefer branch-specific when displaying
      if (branchId !== undefined && branchId !== null) {
        // Fetch both branch-specific and NULL records (for fallback)
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
      } else {
        // When branchId is null/undefined, only fetch NULL branch_id records
        // This matches the report API behavior for tenant admins
        query = query.is('branch_id', null)
      }

      const { data, error } = await query

      if (error) throw error

      set(prev => ({
        openingStocks: data || [],
        loading: { ...prev.loading, opening: false },
        lastFetched: { ...prev.lastFetched, opening: now },
        lastFetchedDate: { ...prev.lastFetchedDate, opening: date },
        error: null,
      }))
    } catch (error) {
      console.error('Error fetching opening stock:', error)
      set(prev => ({
        loading: { ...prev.loading, opening: false },
        error: error instanceof Error ? error.message : 'Failed to fetch opening stock',
        openingStocks: [],
      }))
    }
  },

  fetchClosingStock: async (
    date: string,
    organizationId: string | null,
    branchId?: string | null
  ) => {
    const state = get()
    const now = Date.now()

    if (
      state.lastFetched.closing &&
      state.lastFetchedDate.closing === date &&
      now - state.lastFetched.closing < CACHE_DURATION &&
      !state.loading.closing
    ) {
      return
    }

    set(prev => ({
      loading: { ...prev.loading, closing: true },
      error: null,
    }))

    try {
      let query = supabase
        .from('closing_stock')
        .select(
          `
          *,
          item:items(*)
        `
        )
        .eq('date', date)
        .order('created_at', { ascending: false })

      if (organizationId) {
        query = query.eq('organization_id', organizationId)
      }

      // Filter by branch_id if provided
      // Include NULL branch_id records as fallback (legacy data that's correct)
      if (branchId !== undefined && branchId !== null) {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
      }

      const { data, error } = await query

      if (error) throw error

      set(prev => ({
        closingStocks: data || [],
        loading: { ...prev.loading, closing: false },
        lastFetched: { ...prev.lastFetched, closing: now },
        lastFetchedDate: { ...prev.lastFetchedDate, closing: date },
        error: null,
      }))
    } catch (error) {
      console.error('Error fetching closing stock:', error)
      set(prev => ({
        loading: { ...prev.loading, closing: false },
        error: error instanceof Error ? error.message : 'Failed to fetch closing stock',
        closingStocks: [],
      }))
    }
  },

  fetchRestocking: async (
    date: string,
    organizationId: string | null,
    branchId?: string | null
  ) => {
    const state = get()
    const now = Date.now()

    if (
      state.lastFetched.restocking &&
      state.lastFetchedDate.restocking === date &&
      now - state.lastFetched.restocking < CACHE_DURATION &&
      !state.loading.restocking
    ) {
      return
    }

    set(prev => ({
      loading: { ...prev.loading, restocking: true },
      error: null,
    }))

    try {
      let query = supabase
        .from('restocking')
        .select(
          `
          *,
          item:items(*)
        `
        )
        .eq('date', date)
        .order('created_at', { ascending: false })

      if (organizationId) {
        query = query.eq('organization_id', organizationId)
      }

      // Filter by branch_id if provided
      // Include NULL branch_id records as fallback (legacy data that's correct)
      if (branchId !== undefined && branchId !== null) {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`)
      }

      const { data, error } = await query

      if (error) throw error

      set(prev => ({
        restockings: data || [],
        loading: { ...prev.loading, restocking: false },
        lastFetched: { ...prev.lastFetched, restocking: now },
        lastFetchedDate: { ...prev.lastFetchedDate, restocking: date },
        error: null,
      }))
    } catch (error) {
      console.error('Error fetching restocking:', error)
      set(prev => ({
        loading: { ...prev.loading, restocking: false },
        error: error instanceof Error ? error.message : 'Failed to fetch restocking',
        restockings: [],
      }))
    }
  },

  addOpeningStock: stock => {
    set(state => ({
      openingStocks: [...state.openingStocks, stock],
      lastFetched: { ...state.lastFetched, opening: Date.now() },
    }))
  },

  updateOpeningStock: (stockId, updates) => {
    set(state => ({
      openingStocks: state.openingStocks.map(stock =>
        stock.id === stockId ? { ...stock, ...updates } : stock
      ),
      lastFetched: { ...state.lastFetched, opening: Date.now() },
    }))
  },

  addClosingStock: stock => {
    set(state => ({
      closingStocks: [...state.closingStocks, stock],
      lastFetched: { ...state.lastFetched, closing: Date.now() },
    }))
  },

  updateClosingStock: (stockId, updates) => {
    set(state => ({
      closingStocks: state.closingStocks.map(stock =>
        stock.id === stockId ? { ...stock, ...updates } : stock
      ),
      lastFetched: { ...state.lastFetched, closing: Date.now() },
    }))
  },

  addRestocking: restocking => {
    set(state => ({
      restockings: [...state.restockings, restocking],
      lastFetched: { ...state.lastFetched, restocking: Date.now() },
    }))
  },

  updateRestocking: (restockingId, updates) => {
    set(state => ({
      restockings: state.restockings.map(r => (r.id === restockingId ? { ...r, ...updates } : r)),
      lastFetched: { ...state.lastFetched, restocking: Date.now() },
    }))
  },

  removeRestocking: restockingId => {
    set(state => ({
      restockings: state.restockings.filter(r => r.id !== restockingId),
      lastFetched: { ...state.lastFetched, restocking: Date.now() },
    }))
  },

  clear: () => {
    set({
      openingStocks: [],
      closingStocks: [],
      restockings: [],
      loading: {
        opening: false,
        closing: false,
        restocking: false,
      },
      error: null,
      lastFetched: {
        opening: null,
        closing: null,
        restocking: null,
      },
      lastFetchedDate: {
        opening: null,
        closing: null,
        restocking: null,
      },
    })
  },
}))
