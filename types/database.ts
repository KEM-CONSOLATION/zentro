export type UserRole = 'admin' | 'staff'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  name: string
  unit: string
  quantity: number
  low_stock_threshold: number
  cost_price: number
  selling_price: number
  description: string | null
  created_at: string
  updated_at: string
}

export interface OpeningStock {
  id: string
  item_id: string
  quantity: number
  date: string
  recorded_by: string
  notes: string | null
  cost_price: number | null
  selling_price: number | null
  created_at: string
  item?: Item
  recorded_by_profile?: Profile
}

export interface ClosingStock {
  id: string
  item_id: string
  quantity: number
  date: string
  recorded_by: string
  notes: string | null
  created_at: string
  item?: Item
  recorded_by_profile?: Profile
}

export interface Sale {
  id: string
  item_id: string
  quantity: number
  price_per_unit: number
  total_price: number
  payment_mode: 'cash' | 'transfer'
  date: string
  recorded_by: string
  description: string | null
  restocking_id: string | null
  opening_stock_id: string | null
  batch_label: string | null
  created_at: string
  item?: Item
  recorded_by_profile?: Profile
  restocking?: Restocking
  opening_stock?: OpeningStock
}

export interface Expense {
  id: string
  description: string
  amount: number
  date: string
  recorded_by: string
  category: string | null
  notes: string | null
  created_at: string
  recorded_by_profile?: Profile
}

export interface MenuCategory {
  id: string
  name: string
  description: string | null
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MenuItem {
  id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_available: boolean
  display_order: number
  created_at: string
  updated_at: string
  category?: MenuCategory
}

export interface Restocking {
  id: string
  item_id: string
  quantity: number
  date: string
  recorded_by: string
  notes: string | null
  cost_price: number | null
  selling_price: number | null
  created_at: string
  item?: Item
  recorded_by_profile?: Profile
}

export interface Recipe {
  id: string
  menu_item_id: string | null
  name: string
  description: string | null
  serving_size: number
  preparation_time: number | null
  created_at: string
  updated_at: string
  menu_item?: MenuItem
  ingredients?: RecipeIngredient[]
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  item_id: string
  quantity: number
  unit: string
  notes: string | null
  created_at: string
  item?: Item
  recipe?: Recipe
}

export interface WasteSpoilage {
  id: string
  item_id: string
  quantity: number
  date: string
  type: 'waste' | 'spoilage'
  reason: string | null
  recorded_by: string
  notes: string | null
  created_at: string
  item?: Item
  recorded_by_profile?: Profile
}

