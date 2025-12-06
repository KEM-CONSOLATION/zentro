-- =====================================================
-- MULTI-TENANCY MIGRATION - PART 2
-- =====================================================
-- Run this AFTER Part 1 has been committed
-- Part 1 adds the 'superadmin' enum value
-- Part 2 does everything else
-- =====================================================

-- Step 2: Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Step 3: Add organization_id columns (nullable initially to preserve data)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.opening_stock 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.closing_stock 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add to other tables if they exist (safe - won't fail if table doesn't exist)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restocking') THEN
    ALTER TABLE public.restocking 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'waste_spoilage') THEN
    ALTER TABLE public.waste_spoilage 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_categories') THEN
    ALTER TABLE public.menu_categories 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_items') THEN
    ALTER TABLE public.menu_items 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipes') THEN
    ALTER TABLE public.recipes 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipe_ingredients') THEN
    ALTER TABLE public.recipe_ingredients 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_organization ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_items_organization ON public.items(organization_id);
CREATE INDEX IF NOT EXISTS idx_opening_stock_organization ON public.opening_stock(organization_id);
CREATE INDEX IF NOT EXISTS idx_closing_stock_organization ON public.closing_stock(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_organization ON public.sales(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_organization ON public.expenses(organization_id);

-- Step 5: Create default organization and assign ALL existing data
-- This ensures NO DATA IS LOST - everything goes to one organization
DO $$
DECLARE
  default_org_id UUID;
  admin_user_id UUID;
  superadmin_user_id UUID;
BEGIN
  -- Find princessokbusiness@gmail.com (will be org admin)
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'princessokbusiness@gmail.com'
  LIMIT 1;

  -- Find consolationlotachi@gmail.com (will be superadmin)
  SELECT id INTO superadmin_user_id
  FROM auth.users
  WHERE email = 'consolationlotachi@gmail.com'
  LIMIT 1;

  -- Use admin user if found, otherwise use first user
  IF admin_user_id IS NULL THEN
    SELECT id INTO admin_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  END IF;

  -- Create default organization
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.organizations (name, slug, created_by)
    VALUES ('Default Organization', 'default-org', admin_user_id)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO default_org_id;
    
    -- If org already exists, get its ID
    IF default_org_id IS NULL THEN
      SELECT id INTO default_org_id FROM public.organizations WHERE slug = 'default-org' LIMIT 1;
    END IF;
  END IF;

  -- Assign ALL existing profiles to default organization
  IF default_org_id IS NOT NULL THEN
    UPDATE public.profiles
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;
  END IF;

  -- Set superadmin role for consolationlotachi@gmail.com
  -- Now safe to use since enum was committed in Part 1
  IF superadmin_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET role = 'superadmin'::user_role
    WHERE id = superadmin_user_id;
  END IF;

  -- Assign ALL existing data to default organization (NO DATA LOST)
  IF default_org_id IS NOT NULL THEN
    UPDATE public.items SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.opening_stock SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.closing_stock SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.sales SET organization_id = default_org_id WHERE organization_id IS NULL;
    UPDATE public.expenses SET organization_id = default_org_id WHERE organization_id IS NULL;
    
    -- Update other tables if they exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restocking') THEN
      UPDATE public.restocking SET organization_id = default_org_id WHERE organization_id IS NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'waste_spoilage') THEN
      UPDATE public.waste_spoilage SET organization_id = default_org_id WHERE organization_id IS NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_categories') THEN
      UPDATE public.menu_categories SET organization_id = default_org_id WHERE organization_id IS NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_items') THEN
      UPDATE public.menu_items SET organization_id = default_org_id WHERE organization_id IS NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipes') THEN
      UPDATE public.recipes SET organization_id = default_org_id WHERE organization_id IS NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipe_ingredients') THEN
      UPDATE public.recipe_ingredients SET organization_id = default_org_id WHERE organization_id IS NULL;
    END IF;
  END IF;
END $$;

-- Step 6: Helper functions
CREATE OR REPLACE FUNCTION public.get_user_organization_id(user_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_superadmin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'superadmin'::user_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_user_organization_id(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_superadmin(UUID) TO authenticated, anon;

-- Step 7: Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Step 8: RLS Policies for organizations
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can view their organization or superadmins can view all" ON public.organizations;

CREATE POLICY "Users can view their organization or superadmins can view all"
  ON public.organizations FOR SELECT
  USING (
    id = public.get_user_organization_id(auth.uid()) OR
    public.is_superadmin(auth.uid())
  );

CREATE POLICY "Admins can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (
    auth.uid() = created_by OR
    public.is_superadmin(auth.uid())
  );

CREATE POLICY "Organization creators can update their organization"
  ON public.organizations FOR UPDATE
  USING (
    created_by = auth.uid() OR
    public.is_superadmin(auth.uid())
  );

-- Step 9: Update RLS policies for all tables to include superadmin access
-- Items
DROP POLICY IF EXISTS "Everyone can view items" ON public.items;
DROP POLICY IF EXISTS "Users can view items in their organization" ON public.items;
DROP POLICY IF EXISTS "Users can view items in their organization or superadmins can view all" ON public.items;

CREATE POLICY "Users can view items in their organization or superadmins can view all"
  ON public.items FOR SELECT
  USING (
    organization_id = public.get_user_organization_id(auth.uid()) OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can insert items" ON public.items;
DROP POLICY IF EXISTS "Admins can insert items in their organization" ON public.items;
DROP POLICY IF EXISTS "Admins can insert items in their organization or superadmins can insert anywhere" ON public.items;

CREATE POLICY "Admins can insert items in their organization or superadmins can insert anywhere"
  ON public.items FOR INSERT
  WITH CHECK (
    (organization_id = public.get_user_organization_id(auth.uid()) AND
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'superadmin'::user_role))) OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update items" ON public.items;
DROP POLICY IF EXISTS "Admins can update items in their organization" ON public.items;
DROP POLICY IF EXISTS "Admins can update items in their organization or superadmins can update all" ON public.items;

CREATE POLICY "Admins can update items in their organization or superadmins can update all"
  ON public.items FOR UPDATE
  USING (
    (organization_id = public.get_user_organization_id(auth.uid()) AND
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'superadmin'::user_role))) OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete items in their organization" ON public.items;
DROP POLICY IF EXISTS "Admins can delete items in their organization or superadmins can delete all" ON public.items;

CREATE POLICY "Admins can delete items in their organization or superadmins can delete all"
  ON public.items FOR DELETE
  USING (
    (organization_id = public.get_user_organization_id(auth.uid()) AND
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'superadmin'::user_role))) OR
    public.is_superadmin(auth.uid())
  );

-- Profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their organization or superadmins can view all" ON public.profiles;

CREATE POLICY "Users can view profiles in their organization or superadmins can view all"
  ON public.profiles FOR SELECT
  USING (
    organization_id = public.get_user_organization_id(auth.uid()) OR
    auth.uid() = id OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their organization" ON public.profiles;

CREATE POLICY "Admins can update profiles in their organization or superadmins can update all"
  ON public.profiles FOR UPDATE
  USING (
    (organization_id = public.get_user_organization_id(auth.uid()) AND
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'superadmin'::user_role))) OR
    public.is_superadmin(auth.uid())
  );

-- Opening Stock
DROP POLICY IF EXISTS "Staff can view opening stock" ON public.opening_stock;
DROP POLICY IF EXISTS "Users can view opening stock in their organization" ON public.opening_stock;
DROP POLICY IF EXISTS "Users can view opening stock in their organization or superadmins can view all" ON public.opening_stock;

CREATE POLICY "Users can view opening stock in their organization or superadmins can view all"
  ON public.opening_stock FOR SELECT
  USING (
    organization_id = public.get_user_organization_id(auth.uid()) OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Staff can insert opening stock" ON public.opening_stock;
DROP POLICY IF EXISTS "Users can insert opening stock in their organization" ON public.opening_stock;

CREATE POLICY "Users can insert opening stock in their organization or superadmins can insert anywhere"
  ON public.opening_stock FOR INSERT
  WITH CHECK (
    (organization_id = public.get_user_organization_id(auth.uid()) AND auth.uid() IS NOT NULL) OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update opening stock" ON public.opening_stock;
DROP POLICY IF EXISTS "Admins can update opening stock in their organization" ON public.opening_stock;

CREATE POLICY "Admins can update opening stock in their organization or superadmins can update all"
  ON public.opening_stock FOR UPDATE
  USING (
    (organization_id = public.get_user_organization_id(auth.uid()) AND
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'superadmin'::user_role))) OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete opening stock" ON public.opening_stock;
DROP POLICY IF EXISTS "Admins can delete opening stock in their organization" ON public.opening_stock;

CREATE POLICY "Admins can delete opening stock in their organization or superadmins can delete all"
  ON public.opening_stock FOR DELETE
  USING (
    (organization_id = public.get_user_organization_id(auth.uid()) AND
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'superadmin'::user_role))) OR
    public.is_superadmin(auth.uid())
  );

-- Closing Stock
DROP POLICY IF EXISTS "Staff can view closing stock" ON public.closing_stock;
DROP POLICY IF EXISTS "Users can view closing stock in their organization" ON public.closing_stock;
DROP POLICY IF EXISTS "Users can view closing stock in their organization or superadmins can view all" ON public.closing_stock;

CREATE POLICY "Users can view closing stock in their organization or superadmins can view all"
  ON public.closing_stock FOR SELECT
  USING (
    organization_id = public.get_user_organization_id(auth.uid()) OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Staff can insert closing stock" ON public.closing_stock;
DROP POLICY IF EXISTS "Users can insert closing stock in their organization" ON public.closing_stock;

CREATE POLICY "Users can insert closing stock in their organization or superadmins can insert anywhere"
  ON public.closing_stock FOR INSERT
  WITH CHECK (
    (organization_id = public.get_user_organization_id(auth.uid()) AND auth.uid() IS NOT NULL) OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update closing stock" ON public.closing_stock;
DROP POLICY IF EXISTS "Admins can update closing stock in their organization" ON public.closing_stock;

CREATE POLICY "Admins can update closing stock in their organization or superadmins can update all"
  ON public.closing_stock FOR UPDATE
  USING (
    (organization_id = public.get_user_organization_id(auth.uid()) AND
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'superadmin'::user_role))) OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete closing stock" ON public.closing_stock;
DROP POLICY IF EXISTS "Admins can delete closing stock in their organization" ON public.closing_stock;

CREATE POLICY "Admins can delete closing stock in their organization or superadmins can delete all"
  ON public.closing_stock FOR DELETE
  USING (
    (organization_id = public.get_user_organization_id(auth.uid()) AND
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'superadmin'::user_role))) OR
    public.is_superadmin(auth.uid())
  );

-- Sales
DROP POLICY IF EXISTS "Staff can view sales" ON public.sales;
DROP POLICY IF EXISTS "Users can view sales in their organization" ON public.sales;
DROP POLICY IF EXISTS "Users can view sales in their organization or superadmins can view all" ON public.sales;

CREATE POLICY "Users can view sales in their organization or superadmins can view all"
  ON public.sales FOR SELECT
  USING (
    organization_id = public.get_user_organization_id(auth.uid()) OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Staff can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Users can insert sales in their organization" ON public.sales;

CREATE POLICY "Users can insert sales in their organization or superadmins can insert anywhere"
  ON public.sales FOR INSERT
  WITH CHECK (
    (organization_id = public.get_user_organization_id(auth.uid()) AND auth.uid() IS NOT NULL) OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update sales" ON public.sales;
DROP POLICY IF EXISTS "Admins can update sales in their organization" ON public.sales;

CREATE POLICY "Admins can update sales in their organization or superadmins can update all"
  ON public.sales FOR UPDATE
  USING (
    (organization_id = public.get_user_organization_id(auth.uid()) AND
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'superadmin'::user_role))) OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete sales" ON public.sales;
DROP POLICY IF EXISTS "Admins can delete sales in their organization" ON public.sales;

CREATE POLICY "Admins can delete sales in their organization or superadmins can delete all"
  ON public.sales FOR DELETE
  USING (
    (organization_id = public.get_user_organization_id(auth.uid()) AND
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'superadmin'::user_role))) OR
    public.is_superadmin(auth.uid())
  );

-- Expenses
DROP POLICY IF EXISTS "Users can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can view expenses in their organization" ON public.expenses;
DROP POLICY IF EXISTS "Users can view expenses in their organization or superadmins can view all" ON public.expenses;

CREATE POLICY "Users can view expenses in their organization or superadmins can view all"
  ON public.expenses FOR SELECT
  USING (
    organization_id = public.get_user_organization_id(auth.uid()) OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can insert expenses in their organization" ON public.expenses;

CREATE POLICY "Users can insert expenses in their organization or superadmins can insert anywhere"
  ON public.expenses FOR INSERT
  WITH CHECK (
    (organization_id = public.get_user_organization_id(auth.uid()) AND auth.uid() IS NOT NULL) OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can update expenses in their organization" ON public.expenses;

CREATE POLICY "Admins can update expenses in their organization or superadmins can update all"
  ON public.expenses FOR UPDATE
  USING (
    (organization_id = public.get_user_organization_id(auth.uid()) AND
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'superadmin'::user_role))) OR
    public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can delete expenses in their organization" ON public.expenses;

CREATE POLICY "Admins can delete expenses in their organization or superadmins can delete all"
  ON public.expenses FOR DELETE
  USING (
    (organization_id = public.get_user_organization_id(auth.uid()) AND
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin'::user_role, 'superadmin'::user_role))) OR
    public.is_superadmin(auth.uid())
  );

-- Step 10: Update unique constraints to include organization_id (safe - only if constraint exists)
DO $$
BEGIN
  -- Items: name unique per organization
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_name_key') THEN
    ALTER TABLE public.items DROP CONSTRAINT items_name_key;
  END IF;
  
  -- Opening stock: unique per item, date, and organization
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opening_stock_item_id_date_key') THEN
    ALTER TABLE public.opening_stock DROP CONSTRAINT opening_stock_item_id_date_key;
  END IF;
  
  -- Closing stock: unique per item, date, and organization
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'closing_stock_item_id_date_key') THEN
    ALTER TABLE public.closing_stock DROP CONSTRAINT closing_stock_item_id_date_key;
  END IF;
  
  -- Menu categories: name unique per organization
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'menu_categories_name_key') THEN
    ALTER TABLE public.menu_categories DROP CONSTRAINT menu_categories_name_key;
  END IF;
END $$;

-- Create new unique indexes with organization_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_name_organization ON public.items(name, organization_id) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_opening_stock_item_date_org ON public.opening_stock(item_id, date, organization_id) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_closing_stock_item_date_org ON public.closing_stock(item_id, date, organization_id) WHERE organization_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_categories') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_categories_name_org ON public.menu_categories(name, organization_id) WHERE organization_id IS NOT NULL;
  END IF;
END $$;

-- Step 11: Function to automatically set organization_id on insert
CREATE OR REPLACE FUNCTION public.set_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.get_user_organization_id(auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic organization_id assignment
DROP TRIGGER IF EXISTS set_items_organization_id ON public.items;
CREATE TRIGGER set_items_organization_id
  BEFORE INSERT ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organization_id();

DROP TRIGGER IF EXISTS set_opening_stock_organization_id ON public.opening_stock;
CREATE TRIGGER set_opening_stock_organization_id
  BEFORE INSERT ON public.opening_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organization_id();

DROP TRIGGER IF EXISTS set_closing_stock_organization_id ON public.closing_stock;
CREATE TRIGGER set_closing_stock_organization_id
  BEFORE INSERT ON public.closing_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organization_id();

DROP TRIGGER IF EXISTS set_sales_organization_id ON public.sales;
CREATE TRIGGER set_sales_organization_id
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organization_id();

DROP TRIGGER IF EXISTS set_expenses_organization_id ON public.expenses;
CREATE TRIGGER set_expenses_organization_id
  BEFORE INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organization_id();

-- Add comments
COMMENT ON TABLE public.organizations IS 'Organizations/tenants for multi-tenancy support';
COMMENT ON COLUMN public.profiles.organization_id IS 'Organization this user belongs to';
COMMENT ON COLUMN public.items.organization_id IS 'Organization that owns this item';
COMMENT ON FUNCTION public.get_user_organization_id(UUID) IS 'Returns the organization_id for a given user';
COMMENT ON FUNCTION public.is_superadmin(UUID) IS 'Returns true if user is a superadmin';
COMMENT ON TYPE user_role IS 'User roles: admin (organization admin), staff (organization staff), superadmin (system-wide admin)';
