# Multi-Branch Implementation - Next Steps Guide

## ✅ What's Been Completed

1. **Database Migrations** - All 3 migration files created
2. **TypeScript Types** - All interfaces updated with branch_id
3. **Branch Management APIs** - CRUD operations for branches
4. **User Management APIs** - Updated to accept branch_id
5. **Sales API** - Updated to filter by branch_id (example implementation)
6. **useAuth Hook** - Updated with branch logic

## 🔄 What Needs to Be Done

### 1. Run Database Migrations

**IMPORTANT**: Run these migrations in order in your Supabase SQL Editor:

1. `supabase/migrations/20250109_001_add_branches_table.sql`
2. `supabase/migrations/20250109_002_create_default_branches.sql`
3. `supabase/migrations/20250109_003_migrate_existing_data.sql`

**Note**: These migrations are safe - they add nullable columns first, so existing queries will still work.

### 2. Update Remaining API Routes

Follow the pattern used in `app/api/sales/create/route.ts`:

**Files to update:**
- `app/api/sales/update/route.ts`
- `app/api/items/create/route.ts`
- `app/api/items/update/route.ts`
- `app/api/stock/*/route.ts` (all stock-related APIs)
- `app/api/restocking/*/route.ts` (all restocking APIs)
- `app/api/expenses/*/route.ts` (all expense APIs)

**Pattern to follow:**
```typescript
// 1. Get profile with branch_id
const { data: profile } = await supabase
  .from('profiles')
  .select('organization_id, branch_id, role')
  .eq('id', user_id)
  .single()

// 2. Determine effective branch_id
const effective_branch_id =
  profile.role === 'admin' && !profile.branch_id
    ? branch_id_from_request || null  // Tenant admin
    : profile.branch_id  // Branch manager/staff

// 3. Filter queries
let query = supabase.from('table')
  .eq('organization_id', organizationId)
if (effective_branch_id) {
  query = query.eq('branch_id', effective_branch_id)
}

// 4. Include branch_id in inserts/updates
.insert({
  ...data,
  organization_id,
  branch_id: effective_branch_id,
})
```

### 3. Update Zustand Stores

Update these stores to accept and use branch_id:

**`lib/stores/itemsStore.ts`:**
```typescript
fetchItems: async (organizationId: string, branchId?: string | null) => {
  let query = supabase
    .from('items')
    .select('*')
    .eq('organization_id', organizationId)
  if (branchId) {
    query = query.eq('branch_id', branchId)
  }
  // ...
}
```

**`lib/stores/salesStore.ts`:**
```typescript
fetchSales: async (date: string, organizationId: string, branchId?: string | null) => {
  let query = supabase
    .from('sales')
    .select('*')
    .eq('date', date)
    .eq('organization_id', organizationId)
  if (branchId) {
    query = query.eq('branch_id', branchId)
  }
  // ...
}
```

**`lib/stores/stockStore.ts`:**
- Update `fetchOpeningStock` to accept branchId
- Update `fetchClosingStock` to accept branchId
- Update `fetchRestocking` to accept branchId

### 4. Create Frontend Components

**`components/BranchSelector.tsx`** (NEW):
```typescript
'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { useBranchStore } from '@/lib/stores/branchStore'
import { useEffect } from 'react'

export default function BranchSelector() {
  const { isTenantAdmin, organizationId } = useAuth()
  const { currentBranch, availableBranches, setCurrentBranch, fetchBranches } = useBranchStore()

  useEffect(() => {
    if (isTenantAdmin && organizationId) {
      fetchBranches(organizationId)
    }
  }, [isTenantAdmin, organizationId, fetchBranches])

  // Only show for tenant admin
  if (!isTenantAdmin) return null

  return (
    <select
      value={currentBranch?.id || ''}
      onChange={(e) => {
        const branch = availableBranches.find(b => b.id === e.target.value)
        setCurrentBranch(branch || null)
      }}
      className="..."
    >
      <option value="">All Branches</option>
      {availableBranches.map(branch => (
        <option key={branch.id} value={branch.id}>
          {branch.name}
        </option>
      ))}
    </select>
  )
}
```

**`components/BranchManagement.tsx`** (NEW):
- CRUD interface for branches
- List, create, update, delete branches
- Show branch details and users

### 5. Update Existing Components

**`components/DashboardLayout.tsx`:**
- Add `<BranchSelector />` in header (only for tenant admin)

**`components/UserManagement.tsx`:**
- Add branch selection dropdown when creating users
- Required for staff, optional for admin

**`components/SalesForm.tsx`:**
- Use `branchId` from `useAuth()` hook
- Pass `branchId` to API calls
- Update Zustand store calls to include branchId

**`components/RestockingForm.tsx`:**
- Use `branchId` from `useAuth()` hook
- Pass `branchId` to API calls

**`components/ItemManagement.tsx`:**
- Use `branchId` from `useAuth()` hook
- Filter items by branch

**All other components:**
- Update to use `branchId` from `useAuth()`
- Pass `branchId` to all data fetching

### 6. Update Stock Calculation Logic

**`lib/stock-cascade.ts`:**
- Add `branchId` parameter to all functions
- Filter all queries by `branchId`
- Update `recalculateClosingStock` and `cascadeUpdateFromDate`

### 7. Update RLS Policies

Create new migration file:
**`supabase/migrations/20250109_004_update_rls_for_branches.sql`**

Update RLS policies to include branch_id checks:
```sql
-- Example: Update sales policy
DROP POLICY IF EXISTS "Users can view sales in their organization" ON sales;
CREATE POLICY "Users can view sales in their organization and branch"
  ON sales FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      branch_id IN (
        SELECT branch_id FROM profiles WHERE id = auth.uid()
      )
      OR branch_id IS NULL  -- Tenant admin can see all branches
    )
  );
```

## 🎯 Testing Checklist

After implementation:

- [ ] Run all 3 database migrations
- [ ] Verify "Main Branch" created for each organization
- [ ] Verify existing data migrated to default branches
- [ ] Test branch creation (tenant admin)
- [ ] Test user creation with branch assignment
- [ ] Test branch switching (tenant admin only)
- [ ] Test sales recording (should filter by branch)
- [ ] Test restocking (should filter by branch)
- [ ] Test item management (should filter by branch)
- [ ] Verify branch manager/staff can only see their branch
- [ ] Verify tenant admin can switch branches
- [ ] Test stock calculations per branch

## 📝 Notes

1. **Migration Safety**: All branch_id columns are nullable initially, so existing code will continue to work
2. **Tenant Admin**: Can switch branches, branch_id comes from store/cookie
3. **Branch Manager/Staff**: Fixed branch_id from profile, cannot switch
4. **Default Branch**: Every organization gets a "Main Branch" automatically
5. **Backward Compatibility**: Existing queries without branch_id will still work (but may return data from all branches)

## 🚀 Quick Start

1. **Run migrations** in Supabase SQL Editor (in order)
2. **Test branch creation** via API or UI
3. **Update one component at a time** (start with SalesForm)
4. **Test thoroughly** before moving to next component
5. **Update remaining APIs** following the sales API pattern

