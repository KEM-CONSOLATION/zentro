-- =====================================================
-- MULTI-BRANCH MIGRATION - PART 1
-- =====================================================
-- Add branches table and branch_id columns (nullable initially)
-- This is safe - existing queries will still work
-- =====================================================

-- Step 1: Create branches table
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(organization_id, name)  -- Branch name unique per organization
);

-- Step 2: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_branches_organization ON public.branches(organization_id);
CREATE INDEX IF NOT EXISTS idx_branches_active ON public.branches(is_active);

-- Step 3: Add branch_id columns to profiles (nullable initially)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS default_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- Step 4: Add branch_id columns to all transaction tables (nullable initially)
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE public.opening_stock 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE public.closing_stock 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

-- Add to other tables if they exist (safe - won't fail if table doesn't exist)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restocking') THEN
    ALTER TABLE public.restocking 
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'waste_spoilage') THEN
    ALTER TABLE public.waste_spoilage 
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipes') THEN
    ALTER TABLE public.recipes 
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recipe_ingredients') THEN
    ALTER TABLE public.recipe_ingredients 
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 5: Add indexes for branch_id columns
CREATE INDEX IF NOT EXISTS idx_profiles_branch ON public.profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_items_branch ON public.items(branch_id);
CREATE INDEX IF NOT EXISTS idx_opening_stock_branch ON public.opening_stock(branch_id);
CREATE INDEX IF NOT EXISTS idx_closing_stock_branch ON public.closing_stock(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON public.sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON public.expenses(branch_id);

-- Step 6: Enable RLS on branches table
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies for branches
-- Users can view branches in their organization
CREATE POLICY "Users can view branches in their organization"
  ON public.branches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND organization_id = branches.organization_id
    )
  );

-- Admins can create branches in their organization
CREATE POLICY "Admins can create branches in their organization"
  ON public.branches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND organization_id = branches.organization_id
      AND role IN ('admin', 'superadmin')
    )
  );

-- Admins can update branches in their organization
CREATE POLICY "Admins can update branches in their organization"
  ON public.branches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND organization_id = branches.organization_id
      AND role IN ('admin', 'superadmin')
    )
  );

-- Admins can delete branches in their organization
CREATE POLICY "Admins can delete branches in their organization"
  ON public.branches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND organization_id = branches.organization_id
      AND role IN ('admin', 'superadmin')
    )
  );

