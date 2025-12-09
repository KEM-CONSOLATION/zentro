# Multi-Branch Complete Implementation Guide

## ✅ What's Been Completed

### Database & Types
- ✅ All 3 migration files created
- ✅ All TypeScript interfaces updated with branch_id
- ✅ Branch interface added

### APIs
- ✅ Branch CRUD APIs (`/api/branches/*`)
- ✅ User creation/assignment APIs updated
- ✅ Organization creation auto-creates "Main Branch"
- ✅ Sales API updated with branch_id filtering (example)

### Zustand Stores
- ✅ `itemsStore` - Updated to accept branchId parameter
- ✅ `salesStore` - Updated to accept branchId parameter
- ✅ `stockStore` - Updated to accept branchId parameter (all methods)

### Frontend Components
- ✅ `BranchSelector` - Created (visible only for tenant admin)
- ✅ `DashboardLayout` - Updated to include BranchSelector
- ✅ `SalesForm` - Updated to use branchId from useAuth
- ✅ `useAuth` hook - Updated with branch logic

## 🔄 What Still Needs to Be Done

### 1. Update SalesForm API Calls

In `components/SalesForm.tsx`, add `branch_id` to API calls:

**Find this (around line 800-850):**
```typescript
const response = await fetch('/api/sales/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    item_id: selectedItem,
    quantity: parseFloat(quantity),
    // ... other fields
  }),
})
```

**Update to:**
```typescript
const response = await fetch('/api/sales/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    item_id: selectedItem,
    quantity: parseFloat(quantity),
    branch_id: branchId,  // ADD THIS
    // ... other fields
  }),
})
```

**Also update the update call:**
```typescript
const response = await fetch('/api/sales/update', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sale_id: editingSale.id,
    branch_id: branchId,  // ADD THIS
    // ... other fields
  }),
})
```

### 2. Update Remaining API Routes

Follow the pattern from `app/api/sales/create/route.ts`:

**Files to update:**
- `app/api/sales/update/route.ts`
- `app/api/stock/*/route.ts` (all stock APIs)
- `app/api/restocking/*/route.ts` (if exists)
- `app/api/expenses/*/route.ts` (if exists)
- `app/api/items/*/route.ts` (if exists)

**Pattern:**
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
    ? branch_id_from_request || null
    : profile.branch_id

// 3. Filter queries
let query = supabase.from('table')
  .eq('organization_id', organizationId)
if (effective_branch_id) {
  query = query.eq('branch_id', effective_branch_id)
}

// 4. Include in inserts/updates
.insert({
  ...data,
  organization_id,
  branch_id: effective_branch_id,
})
```

### 3. Update Other Components

**Components to update:**
- `components/RestockingForm.tsx` - Add branchId usage
- `components/ItemManagement.tsx` - Add branchId usage
- `components/DailyStockReport.tsx` - Add branchId usage
- `components/ExpensesForm.tsx` - Add branchId usage
- All other components that fetch data

**Pattern for each:**
```typescript
const { branchId, organizationId } = useAuth()

// Update store calls
fetchItemsFromStore(organizationId, branchId)
fetchSalesFromStore(date, organizationId, branchId)
// etc.

// Update API calls
body: JSON.stringify({
  ...data,
  branch_id: branchId,
})
```

### 4. Update Stock Cascade Logic

**File: `lib/stock-cascade.ts`**

Add `branchId` parameter to all functions and filter queries:

```typescript
export async function recalculateClosingStock(
  date: string,
  userId: string,
  branchId?: string | null
) {
  // Get organization_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, branch_id, role')
    .eq('id', userId)
    .single()

  const effective_branch_id =
    profile.role === 'admin' && !profile.branch_id
      ? branchId || null
      : profile.branch_id

  // Filter all queries by branch_id
  let openingQuery = supabase
    .from('opening_stock')
    .select('*')
    .eq('date', date)
    .eq('organization_id', profile.organization_id)
  if (effective_branch_id) {
    openingQuery = openingQuery.eq('branch_id', effective_branch_id)
  }
  // ... etc for all queries
}
```

### 5. Create BranchManagement Component

**File: `components/BranchManagement.tsx`** (NEW)

Create a full CRUD interface for branches:
- List all branches
- Create new branch
- Update branch
- Delete branch
- Assign users to branches

### 6. Update UserManagement Component

**File: `components/UserManagement.tsx`**

Add branch selection when creating users:
- Show branch dropdown for staff
- Optional for admin (tenant admin)
- Required for staff

### 7. Update RLS Policies

**File: `supabase/migrations/20250109_004_update_rls_for_branches.sql`** (NEW)

Update RLS policies to include branch_id checks.

## 🎯 Critical: Ensure No Data Loss

### Migration Safety

1. **All branch_id columns are nullable** - Existing queries work
2. **Default branches created** - All existing data assigned
3. **Backward compatible** - Queries without branch_id still work

### Testing Checklist

After running migrations:

- [ ] Verify all existing users still work
- [ ] Verify all existing records are accessible
- [ ] Verify sales can still be recorded
- [ ] Verify restocking still works
- [ ] Verify stock calculations still work
- [ ] Test branch switching (tenant admin)
- [ ] Test branch-specific data (branch manager/staff)

## 🚀 Quick Implementation Order

1. **Run migrations** (in Supabase SQL Editor)
2. **Update SalesForm API calls** (add branch_id)
3. **Update one component at a time** (test each)
4. **Update remaining APIs** (follow sales pattern)
5. **Update stock cascade** (add branch filtering)
6. **Create BranchManagement** (full CRUD)
7. **Update UserManagement** (add branch selection)
8. **Test thoroughly**

## 📝 Important Notes

1. **Tenant Admin**: Can switch branches, branch_id comes from store/cookie
2. **Branch Manager/Staff**: Fixed branch_id from profile, cannot switch
3. **Backward Compatibility**: All queries work without branch_id (shows all branches)
4. **Migration Safety**: Nullable columns ensure no data loss
5. **Default Branch**: Every organization gets "Main Branch" automatically

