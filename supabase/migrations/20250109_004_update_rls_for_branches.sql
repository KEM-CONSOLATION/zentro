-- Migration: Update RLS policies to include branch_id filtering
-- This ensures users can only access data from their own branch (or all branches if tenant admin)

-- Drop existing policies that need to be updated
DROP POLICY IF EXISTS "Users can view their own organization's items" ON items;
DROP POLICY IF EXISTS "Users can insert items for their organization" ON items;
DROP POLICY IF EXISTS "Users can update their organization's items" ON items;
DROP POLICY IF EXISTS "Users can delete their organization's items" ON items;

DROP POLICY IF EXISTS "Users can view their organization's sales" ON sales;
DROP POLICY IF EXISTS "Users can insert sales for their organization" ON sales;
DROP POLICY IF EXISTS "Users can update their organization's sales" ON sales;
DROP POLICY IF EXISTS "Users can delete their organization's sales" ON sales;

DROP POLICY IF EXISTS "Users can view their organization's opening stock" ON opening_stock;
DROP POLICY IF EXISTS "Users can insert opening stock for their organization" ON opening_stock;
DROP POLICY IF EXISTS "Users can update their organization's opening stock" ON opening_stock;
DROP POLICY IF EXISTS "Users can delete their organization's opening stock" ON opening_stock;

DROP POLICY IF EXISTS "Users can view their organization's closing stock" ON closing_stock;
DROP POLICY IF EXISTS "Users can insert closing stock for their organization" ON closing_stock;
DROP POLICY IF EXISTS "Users can update their organization's closing stock" ON closing_stock;
DROP POLICY IF EXISTS "Users can delete their organization's closing stock" ON closing_stock;

DROP POLICY IF EXISTS "Users can view their organization's restocking" ON restocking;
DROP POLICY IF EXISTS "Users can insert restocking for their organization" ON restocking;
DROP POLICY IF EXISTS "Users can update their organization's restocking" ON restocking;
DROP POLICY IF EXISTS "Users can delete their organization's restocking" ON restocking;

DROP POLICY IF EXISTS "Users can view their organization's expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert expenses for their organization" ON expenses;
DROP POLICY IF EXISTS "Users can update their organization's expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete their organization's expenses" ON expenses;

DROP POLICY IF EXISTS "Users can view their organization's waste/spoilage" ON waste_spoilage;
DROP POLICY IF EXISTS "Users can insert waste/spoilage for their organization" ON waste_spoilage;
DROP POLICY IF EXISTS "Users can update their organization's waste/spoilage" ON waste_spoilage;
DROP POLICY IF EXISTS "Users can delete their organization's waste/spoilage" ON waste_spoilage;

-- Helper function to check if user is tenant admin (admin without branch_id)
CREATE OR REPLACE FUNCTION is_tenant_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role = 'admin'
    AND branch_id IS NULL
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to get user's effective branch_id
-- Returns NULL for tenant admins (can access all branches), or the user's branch_id
CREATE OR REPLACE FUNCTION get_user_effective_branch_id(user_id UUID)
RETURNS UUID AS $$
  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_id
        AND role = 'admin'
        AND branch_id IS NULL
      ) THEN NULL -- Tenant admin: can access all branches
      ELSE (SELECT branch_id FROM profiles WHERE id = user_id) -- Branch manager/staff: fixed branch
    END;
$$ LANGUAGE sql SECURITY DEFINER;

-- Items policies (items are organization-level, but can have branch_id for tracking)
CREATE POLICY "Users can view their organization's items"
  ON items FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert items for their organization"
  ON items FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organization's items"
  ON items FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their organization's items"
  ON items FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Sales policies (branch-aware)
CREATE POLICY "Users can view their organization's sales"
  ON sales FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can insert sales for their organization"
  ON sales FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can update their organization's sales"
  ON sales FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can delete their organization's sales"
  ON sales FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

-- Opening stock policies (branch-aware)
CREATE POLICY "Users can view their organization's opening stock"
  ON opening_stock FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can insert opening stock for their organization"
  ON opening_stock FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can update their organization's opening stock"
  ON opening_stock FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can delete their organization's opening stock"
  ON opening_stock FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

-- Closing stock policies (branch-aware)
CREATE POLICY "Users can view their organization's closing stock"
  ON closing_stock FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can insert closing stock for their organization"
  ON closing_stock FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can update their organization's closing stock"
  ON closing_stock FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can delete their organization's closing stock"
  ON closing_stock FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

-- Restocking policies (branch-aware)
CREATE POLICY "Users can view their organization's restocking"
  ON restocking FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can insert restocking for their organization"
  ON restocking FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can update their organization's restocking"
  ON restocking FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can delete their organization's restocking"
  ON restocking FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

-- Expenses policies (branch-aware)
CREATE POLICY "Users can view their organization's expenses"
  ON expenses FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can insert expenses for their organization"
  ON expenses FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can update their organization's expenses"
  ON expenses FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can delete their organization's expenses"
  ON expenses FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

-- Waste/Spoilage policies (branch-aware)
CREATE POLICY "Users can view their organization's waste/spoilage"
  ON waste_spoilage FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can insert waste/spoilage for their organization"
  ON waste_spoilage FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can update their organization's waste/spoilage"
  ON waste_spoilage FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

CREATE POLICY "Users can delete their organization's waste/spoilage"
  ON waste_spoilage FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
      get_user_effective_branch_id(auth.uid()) IS NULL -- Tenant admin: all branches
      OR branch_id = get_user_effective_branch_id(auth.uid()) -- Branch manager/staff: own branch
    )
  );

-- Branches policies (only tenant admins can manage branches)
CREATE POLICY "Users can view their organization's branches"
  ON branches FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert branches for their organization"
  ON branches FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND is_tenant_admin(auth.uid()) -- Only tenant admins can create branches
  );

CREATE POLICY "Users can update their organization's branches"
  ON branches FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND is_tenant_admin(auth.uid()) -- Only tenant admins can update branches
  );

CREATE POLICY "Users can delete their organization's branches"
  ON branches FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND is_tenant_admin(auth.uid()) -- Only tenant admins can delete branches
  );

