# Multi-Tenancy Setup Guide

This application now supports **multi-tenancy** - multiple organizations (admins) with their own staff and completely separate data.

## ✅ DATA PRESERVATION GUARANTEED

**IMPORTANT**: The migration is designed to preserve ALL existing data:
- All existing users will be assigned to a default organization
- All existing data (items, sales, stock, etc.) will be assigned to that organization
- **NO DATA WILL BE LOST**

## How It Works

- Each **organization** has its own admin and staff members
- All data (items, sales, stock, etc.) is isolated per organization
- Users can only see and manage data from their own organization
- **Superadmins** can see and manage data from ALL organizations
- Row Level Security (RLS) automatically enforces data isolation

## User Roles

- **superadmin**: System-wide admin (consolationlotachi@gmail.com) - can see everything
- **admin**: Organization admin (princessokbusiness@gmail.com) - manages their organization
- **staff**: Organization staff - can view/insert data in their organization

## Setup Steps

### 1. Run the Safe Migration SQL

1. Open your Supabase dashboard
2. Go to **SQL Editor**
3. Run the file: `supabase/add_multi_tenancy_safe.sql`
4. This will:
   - Create `organizations` table
   - Add `organization_id` to all tables (nullable initially)
   - Create default organization
   - Assign ALL existing users to default organization
   - Assign ALL existing data to default organization
   - Set princessokbusiness@gmail.com as org admin
   - Set consolationlotachi@gmail.com as superadmin
   - Update RLS policies for organization isolation + superadmin access
   - Create helper functions and triggers

### 2. Verify Migration Results

After running the migration, verify:

1. **Default organization created**:
```sql
SELECT * FROM public.organizations WHERE slug = 'default-org';
```

2. **All users assigned to organization**:
```sql
SELECT COUNT(*) FROM public.profiles WHERE organization_id IS NOT NULL;
-- Should match total number of users
```

3. **Superadmin role set**:
```sql
SELECT email, role FROM public.profiles WHERE email = 'consolationlotachi@gmail.com';
-- Should show role = 'superadmin'
```

4. **All data assigned to organization**:
```sql
SELECT COUNT(*) FROM public.items WHERE organization_id IS NOT NULL;
SELECT COUNT(*) FROM public.sales WHERE organization_id IS NOT NULL;
-- Should match total records
```

### 3. Update Application Code

The application code needs to be updated to:
- Automatically include `organization_id` in queries
- Show organization selection during signup (for new admins)
- Display organization name in the UI

## Key Features

### Automatic Organization Assignment
- When a user creates a record, it's automatically assigned to their organization
- Triggers ensure `organization_id` is set on insert

### Data Isolation
- Users can only see data from their organization
- RLS policies enforce this at the database level
- No code changes needed - RLS handles it automatically

### Organization Management
- Admins can create organizations
- Each organization has a unique slug
- Staff members are assigned to the same organization as the admin who created them

## Database Schema Changes

### New Table: `organizations`
- `id` (UUID, Primary Key)
- `name` (TEXT) - Organization name
- `slug` (TEXT, Unique) - URL-friendly identifier
- `created_by` (UUID) - Admin who created it
- `created_at`, `updated_at`

### Updated Tables (added `organization_id`)
- `profiles`
- `items`
- `opening_stock`
- `closing_stock`
- `sales`
- `expenses`
- `restocking`
- `waste_spoilage`
- `menu_categories`
- `menu_items`
- `recipes`
- `recipe_ingredients`

## RLS Policies

All RLS policies now filter by `organization_id`:
- Users can only SELECT records where `organization_id` matches their organization
- Users can only INSERT records with their `organization_id`
- Admins can UPDATE/DELETE only records in their organization

## Migration for Existing Data

If you have existing data, you'll need to:

1. **Create organizations** for existing admins
2. **Assign existing data** to organizations:

```sql
-- Example: Assign all existing items to an organization
UPDATE public.items
SET organization_id = 'ORGANIZATION_ID_HERE'
WHERE organization_id IS NULL;

-- Repeat for all tables
```

## Testing

1. Create two organizations
2. Create an admin in each organization
3. Create staff members in each organization
4. Verify that:
   - Admin 1 can only see their organization's data
   - Admin 2 can only see their organization's data
   - Staff members can only see their organization's data
   - Data is completely isolated

## Next Steps

1. ✅ Run the migration SQL
2. ⏳ Update signup flow to create organizations for new admins
3. ⏳ Add organization selection/display in UI
4. ⏳ Update all API routes to handle organization context
5. ⏳ Test multi-tenant isolation

