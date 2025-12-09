# User-Branch Relationship Design

## Recommended Structure

### Database Schema

```sql
-- Branches table
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, name)  -- Branch name unique per organization
);

-- Update profiles table
ALTER TABLE profiles ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN default_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Add indexes
CREATE INDEX idx_branches_organization ON branches(organization_id);
CREATE INDEX idx_profiles_branch ON profiles(branch_id);
```

### Role-Based Branch Assignment

```typescript
interface Profile {
  id: string
  role: 'tenant_admin' | 'branch_manager' | 'staff'
  organization_id: string
  branch_id: string | null        // NULL for tenant_admin
  default_branch_id: string | null // For tenant_admin (selected branch)
}
```

**Logic:**
- **Tenant Admin**: `branch_id = NULL`, uses `default_branch_id` from cookie/store
- **Branch Manager**: `branch_id = their_branch_id` (fixed)
- **Staff**: `branch_id = their_branch_id` (fixed)

---

## Onboarding Flow

### Step 1: Organization Created

```typescript
// Auto-create "Main Branch" when organization is created
POST /api/organizations/create
{
  name: "La Cuisine Restaurant"
}

// Backend automatically:
// 1. Create organization
// 2. Create "Main Branch" for that organization
// 3. Return both
```

### Step 2: Create Tenant Admin

```typescript
POST /api/users/create
{
  email: "admin@lacuisine.com",
  password: "password123",
  fullName: "John Admin",
  role: "tenant_admin",  // or keep as "admin"
  organization_id: "org-123"
  // branch_id: null (for tenant admin)
}
```

### Step 3: Create Branch Manager

```typescript
POST /api/users/create
{
  email: "manager@lacuisine.com",
  password: "password123",
  fullName: "Jane Manager",
  role: "branch_manager",
  organization_id: "org-123",
  branch_id: "branch-main-123"  // Required for manager
}
```

### Step 4: Create Staff

```typescript
POST /api/users/create
{
  email: "cashier@lacuisine.com",
  password: "password123",
  fullName: "Bob Cashier",
  role: "staff",
  organization_id: "org-123",
  branch_id: "branch-main-123"  // Required for staff
}
```

### Step 5: Create Additional Branches

```typescript
POST /api/branches/create
{
  organization_id: "org-123",
  name: "Downtown Branch",
  address: "123 Main Street"
}
```

### Step 6: Assign Users to New Branch

```typescript
PUT /api/users/assign-branch
{
  user_id: "user-456",
  branch_id: "branch-downtown-789"
}
```

---

## Query Pattern

### For Tenant Admin (Can Switch Branches)

```typescript
const { currentBranch, organizationId } = useAuth()
const branchId = currentBranch?.id || null

// Query with both filters
let query = supabase.from('sales')
  .eq('organization_id', organizationId)
  
if (branchId) {
  query = query.eq('branch_id', branchId)
} else {
  // Tenant admin viewing all branches
  // Don't filter by branch_id
}
```

### For Branch Manager/Staff (Fixed Branch)

```typescript
const { branchId, organizationId } = useAuth()

// Always filter by their branch
let query = supabase.from('sales')
  .eq('organization_id', organizationId)
  .eq('branch_id', branchId)  // Always required
```

---

## API Endpoints Needed

### Branch Management

```typescript
// Create branch
POST /api/branches/create
{
  organization_id: string
  name: string
  address?: string
}

// List branches
GET /api/branches?organization_id=xxx

// Update branch
PUT /api/branches/:id

// Delete branch
DELETE /api/branches/:id
```

### User-Branch Assignment

```typescript
// Assign user to branch
PUT /api/users/assign-branch
{
  user_id: string
  branch_id: string
}

// Get users for a branch
GET /api/users?branch_id=xxx

// Get branches for a user
GET /api/users/:id/branches
```

---

## UI Components Needed

### 1. Branch Selector (Tenant Admin Only)

```typescript
// components/BranchSelector.tsx
// Only visible for tenant_admin
// Shows dropdown of all branches
// Saves selection to cookie/store
```

### 2. Branch Management

```typescript
// components/BranchManagement.tsx
// CRUD for branches
// Assign users to branches
// View branch details
```

### 3. User Creation Form Update

```typescript
// components/UserManagement.tsx
// Add branch selection when creating user
// Required for branch_manager and staff
// Optional/hidden for tenant_admin
```

---

## Migration Strategy

### Step 1: Add Tables & Columns (Safe)

```sql
-- Create branches table
CREATE TABLE branches (...);

-- Add branch_id columns (NULLABLE)
ALTER TABLE profiles ADD COLUMN branch_id UUID;
ALTER TABLE items ADD COLUMN branch_id UUID;
ALTER TABLE sales ADD COLUMN branch_id UUID;
-- etc.
```

### Step 2: Create Default Branches

```sql
-- For each organization, create "Main Branch"
INSERT INTO branches (organization_id, name)
SELECT id, name || ' - Main Branch'
FROM organizations;
```

### Step 3: Migrate Existing Data

```sql
-- Assign all existing data to default branch
UPDATE profiles SET branch_id = (
  SELECT id FROM branches 
  WHERE organization_id = profiles.organization_id 
  LIMIT 1
) WHERE branch_id IS NULL;

UPDATE items SET branch_id = (
  SELECT id FROM branches 
  WHERE organization_id = items.organization_id 
  LIMIT 1
) WHERE branch_id IS NULL;

-- etc. for all tables
```

### Step 4: Make Required (After Migration)

```sql
-- After all data is migrated
ALTER TABLE profiles ALTER COLUMN branch_id SET NOT NULL;
-- etc.
```

---

## Validation Rules

### When Creating User

```typescript
if (role === 'branch_manager' || role === 'staff') {
  if (!branch_id) {
    throw new Error('branch_id is required for branch_manager and staff')
  }
}

if (role === 'tenant_admin') {
  // branch_id should be null
  branch_id = null
}
```

### When Creating Branch

```typescript
// Branch name must be unique per organization
const existing = await supabase
  .from('branches')
  .select('id')
  .eq('organization_id', organization_id)
  .eq('name', name)
  .single()

if (existing) {
  throw new Error('Branch name already exists for this organization')
}
```

---

## Summary

**Recommended Structure:**
- ✅ Simple: One `branch_id` column on profile
- ✅ Clear: NULL = tenant admin (can switch), value = fixed branch
- ✅ Easy: Same query pattern as organization
- ✅ Flexible: Can add junction table later if needed

**Onboarding:**
1. Create org → Auto-create "Main Branch"
2. Create users → Assign branch_id
3. Create more branches → Assign users

**This is the cleanest, simplest approach!** 🎯

