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
          item:items!left(*),
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

      // Always filter by branch_id when provided
      if (branchId !== undefined && branchId !== null) {
        salesQuery = salesQuery.eq('branch_id', branchId)
      }

      const { data, error } = await salesQuery

      if (error) throw error

      // If any sales have missing items, try to fetch them separately
      // This handles cases where items were deleted but sales records remain
      const salesWithMissingItems = (data || []).filter(sale => !sale.item && sale.item_id)
      if (salesWithMissingItems.length > 0) {
        const missingItemIds = [...new Set(salesWithMissingItems.map(s => s.item_id))]
        const { data: missingItems } = await supabase
          .from('items')
          .select('*')
          .in('id', missingItemIds)

        // Create a map of items by id
        const itemsMap = new Map((missingItems || []).map(item => [item.id, item]))

        // Update sales with missing items
        const updatedSales = (data || []).map(sale => {
          if (!sale.item && sale.item_id && itemsMap.has(sale.item_id)) {
            return { ...sale, item: itemsMap.get(sale.item_id) }
          }
          return sale
        })

        set({
          sales: updatedSales,
          loading: false,
          lastFetched: now,
          lastFetchedDate: date,
          error: null,
        })
      } else {
        set({
          sales: data || [],
          loading: false,
          lastFetched: now,
          lastFetchedDate: date,
          error: null,
        })
      }
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
