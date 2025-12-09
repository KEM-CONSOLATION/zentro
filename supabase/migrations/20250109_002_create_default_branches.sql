-- =====================================================
-- MULTI-BRANCH MIGRATION - PART 2
-- =====================================================
-- Create default "Main Branch" for each existing organization
-- =====================================================

DO $$
DECLARE
  org_record RECORD;
  main_branch_id UUID;
BEGIN
  -- Loop through all organizations
  FOR org_record IN 
    SELECT id, name FROM public.organizations
  LOOP
    -- Check if organization already has a branch
    IF NOT EXISTS (
      SELECT 1 FROM public.branches 
      WHERE organization_id = org_record.id
      LIMIT 1
    ) THEN
      -- Create "Main Branch" for this organization
      INSERT INTO public.branches (organization_id, name, is_active)
      VALUES (org_record.id, org_record.name || ' - Main Branch', true)
      RETURNING id INTO main_branch_id;
      
      RAISE NOTICE 'Created Main Branch for organization: % (branch_id: %)', org_record.name, main_branch_id;
    END IF;
  END LOOP;
END $$;

