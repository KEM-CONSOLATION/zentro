# Multi-Tenancy Migration Guide

## ✅ DATA PRESERVATION GUARANTEED

This migration is designed to **preserve ALL existing data**. No data will be lost.

## What This Migration Does

1. **Creates organizations table** - For multi-tenant support
2. **Adds organization_id to all tables** - Links data to organizations
3. **Creates default organization** - "Default Organization"
4. **Assigns ALL existing users** - All users go to the default organization
5. **Assigns ALL existing data** - All items, sales, stock, etc. go to the default organization
6. **Sets roles**:
   - `princessokbusiness@gmail.com` → **admin** (organization admin)
   - `consolationlotachi@gmail.com` → **superadmin** (system-wide admin)
7. **Updates RLS policies** - Superadmins can see everything, regular admins see only their organization

## Migration Steps

### 1. Run the Safe Migration SQL (TWO PARTS REQUIRED)

**⚠️ IMPORTANT**: PostgreSQL requires enum values to be committed before use. You MUST run this in TWO separate steps:

#### Part 1: Add Enum Value (Run First)
1. Open your Supabase dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `supabase/add_multi_tenancy_safe_part1.sql`
4. Click **Run**
5. **Wait for it to complete** - this adds the 'superadmin' enum value

#### Part 2: Complete Migration (Run After Part 1)
1. In the same SQL Editor (or a new query tab)
2. Copy and paste the contents of `supabase/add_multi_tenancy_safe_part2.sql`
3. Click **Run**

**Why two parts?** PostgreSQL doesn't allow using a new enum value in the same transaction where it's created. Part 1 commits the enum, Part 2 uses it.

**Alternative**: If you already ran Part 1 and got an error, just run Part 2 now - the enum value is already there.

### 2. Verify Migration

After running, verify the migration worked:

```sql
-- Check default organization was created
SELECT * FROM public.organizations WHERE slug = 'default-org';

-- Check all users are assigned
SELECT COUNT(*) FROM public.profiles WHERE organization_id IS NOT NULL;

-- Check superadmin role
SELECT email, role FROM public.profiles WHERE email = 'consolationlotachi@gmail.com';
-- Should show: role = 'superadmin'

-- Check all data is assigned
SELECT COUNT(*) FROM public.items WHERE organization_id IS NOT NULL;
SELECT COUNT(*) FROM public.sales WHERE organization_id IS NOT NULL;
```

### 3. Test the Application

1. **Login as superadmin** (`consolationlotachi@gmail.com`)
   - Should see "Super Admin" tab in Admin Dashboard
   - Can view all organizations
   - Can see all data across organizations

2. **Login as admin** (`princessokbusiness@gmail.com`)
   - Should see normal admin dashboard
   - Can only see data from their organization
   - Can manage users in their organization

3. **Login as staff**
   - Should see normal dashboard
   - Can only see data from their organization

## User Roles

- **superadmin**: System-wide admin (consolationlotachi@gmail.com)
  - Can see ALL organizations
  - Can see ALL data across organizations
  - Can manage everything

- **admin**: Organization admin (princessokbusiness@gmail.com)
  - Can see only their organization
  - Can manage users in their organization
  - Can manage data in their organization

- **staff**: Organization staff
  - Can see only their organization
  - Can view/insert data in their organization
  - Cannot manage users

## What Changed in the Code

1. **TypeScript types**: Added `'superadmin'` to `UserRole` type
2. **Admin page**: Now allows superadmins
3. **Admin Dashboard**: Added "Super Admin" tab (only visible to superadmins)
4. **Role checks**: Updated throughout the app to include superadmin
5. **RLS policies**: Superadmins bypass organization filtering

## Important Notes

- **No data is lost** - Everything is assigned to the default organization
- **Existing users** - All remain in the default organization
- **Future users** - Will be assigned to the organization of the admin who creates them
- **Superadmin access** - Can see everything, but should be used carefully

## Troubleshooting

If you encounter issues:

1. **Check organization assignment**:
   ```sql
   SELECT id, email, role, organization_id FROM public.profiles;
   ```

2. **Check data assignment**:
   ```sql
   SELECT COUNT(*) as total, COUNT(organization_id) as assigned 
   FROM public.items;
   ```

3. **Re-run migration** (safe to run multiple times):
   - The migration uses `IF NOT EXISTS` and `ON CONFLICT` clauses
   - It won't duplicate data

## Next Steps

After migration:
1. Test login as superadmin
2. Test login as admin
3. Verify data is visible correctly
4. Create a new organization (if needed) via SQL or UI

