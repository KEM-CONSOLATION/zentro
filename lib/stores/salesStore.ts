import { create } from 'zustand'
import { Sale, Item, Profile } from '@/types/database'
import { supabase } from '@/lib/supabase/client'

interface SalesState {
  sales: (Sale & { item?: Item; recorded_by_profile?: Profile })[]
  loading: boolean
  error: string | null
  lastFetched: number | null
  lastFetchedDate: string | null
  fetchSales: (
    date: string,
    organizationId: string | null,
    branchId?: string | null
  ) => Promise<void>
  addSale: (sale: Sale & { item?: Item; recorded_by_profile?: Profile }) => void
  updateSale: (saleId: string, updates: Partial<Sale>) => void
  removeSale: (saleId: string) => void
  clear: () => void
}

const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes

export const useSalesStore = create<SalesState>((set, get) => ({
  sales: [],
  loading: false,
  error: null,
  lastFetched: null,
  lastFetchedDate: null,

  fetchSales: async (date: string, organizationId: string | null, branchId?: string | null) => {
    const state = get()
    const now = Date.now()

    // Return cached data if still fresh and same date
    if (
      state.lastFetched &&
      state.lastFetchedDate === date &&
      now - state.lastFetched < CACHE_DURATION &&
      state.sales.length >= 0 &&
      !state.loading
    ) {
      return
    }

    set({ loading: true, error: null })

    try {
      let salesQuery = supabase
        .from('sales')
        .select(
          `
          *,
          item:items(*),
          recorded_by_profile:profiles(*),
          restocking:restocking(*),
          opening_stock:opening_stock(*)
        `
        )
        .eq('date', date)
        .order('created_at', { ascending: false })

      if (organizationId) {
        salesQuery = salesQuery.eq('organization_id', organizationId)
      }

      // Filter by branch_id if provided; include legacy null branch rows for admins to see historical data
      if (branchId !== undefined && branchId !== null) {
        salesQuery = salesQuery.or(`branch_id.eq.${branchId},branch_id.is.null`)
      }

      const { data, error } = await salesQuery

      if (error) throw error

      set({
        sales: data || [],
        loading: false,
        lastFetched: now,
        lastFetchedDate: date,
        error: null,
      })
    } catch (error) {
      console.error('Error fetching sales:', error)
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch sales',
        sales: [],
      })
    }
  },

  addSale: sale => {
    set(state => ({
      sales: [sale, ...state.sales],
      lastFetched: Date.now(),
    }))
  },

  updateSale: (saleId, updates) => {
    set(state => ({
      sales: state.sales.map(sale => (sale.id === saleId ? { ...sale, ...updates } : sale)),
      lastFetched: Date.now(),
    }))
  },

  removeSale: saleId => {
    set(state => ({
      sales: state.sales.filter(sale => sale.id !== saleId),
      lastFetched: Date.now(),
    }))
  },

  clear: () => {
    set({
      sales: [],
      loading: false,
      error: null,
      lastFetched: null,
      lastFetchedDate: null,
    })
  },
}))
