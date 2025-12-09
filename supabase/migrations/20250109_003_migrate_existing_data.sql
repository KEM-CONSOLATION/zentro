-- =====================================================
-- MULTI-BRANCH MIGRATION - PART 3
-- =====================================================
-- Migrate existing data to default branches
-- Assign all existing records to their organization's main branch
-- =====================================================

DO $$
DECLARE
  org_record RECORD;
  main_branch_id UUID;
BEGIN
  -- Loop through all organizations
  FOR org_record IN 
    SELECT id FROM public.organizations
  LOOP
    -- Get the main branch for this organization
    SELECT id INTO main_branch_id
    FROM public.branches
    WHERE organization_id = org_record.id
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF main_branch_id IS NOT NULL THEN
      -- Update profiles (assign to main branch if they don't have one)
      UPDATE public.profiles
      SET branch_id = main_branch_id
      WHERE organization_id = org_record.id
      AND branch_id IS NULL
      AND role != 'superadmin';  -- Superadmins don't have branch_id
      
      -- Update items
      UPDATE public.items
      SET branch_id = main_branch_id
      WHERE organization_id = org_record.id
      AND branch_id IS NULL;
      
      -- Update opening_stock
      UPDATE public.opening_stock
      SET branch_id = main_branch_id
      WHERE organization_id = org_record.id
      AND branch_id IS NULL;
      
      -- Update closing_stock
      UPDATE public.closing_stock
      SET branch_id = main_branch_id
      WHERE organization_id = org_record.id
      AND branch_id IS NULL;
      
      -- Update sales
      UPDATE public.sales
      SET branch_id = main_branch_id
      WHERE organization_id = org_record.id
      AND branch_id IS NULL;
      
      -- Update expenses
      UPDATE public.expenses
      SET branch_id = main_branch_id
      WHERE organization_id = org_record.id
      AND branch_id IS NULL;
      
      -- Update restocking (if table exists)
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restocking') THEN
        UPDATE public.restocking
        SET branch_id = main_branch_id
        WHERE organization_id = org_record.id
        AND branch_id IS NULL;
      END IF;
      
      -- Update waste_spoilage (if table exists)
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'waste_spoilage') THEN
        UPDATE public.waste_spoilage
        SET branch_id = main_branch_id
        WHERE organization_id = org_record.id
        AND branch_id IS NULL;
      END IF;
      
      RAISE NOTICE 'Migrated data for organization: % to branch: %', org_record.id, main_branch_id;
    END IF;
  END LOOP;
END $$;

