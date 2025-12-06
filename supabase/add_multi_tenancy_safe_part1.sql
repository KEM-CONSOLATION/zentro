-- =====================================================
-- MULTI-TENANCY MIGRATION - PART 1
-- =====================================================
-- This must be run FIRST and committed before Part 2
-- 
-- The issue: PostgreSQL requires enum values to be committed
-- before they can be used in the same transaction
-- =====================================================

-- Step 1: Add superadmin to user_role enum
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'superadmin' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'superadmin';
  END IF;
END $$;

-- After running this, COMMIT the transaction, then run Part 2

