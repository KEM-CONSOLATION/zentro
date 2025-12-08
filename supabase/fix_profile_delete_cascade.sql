ALTER TABLE public.opening_stock 
  ALTER COLUMN recorded_by DROP NOT NULL;

ALTER TABLE public.closing_stock 
  ALTER COLUMN recorded_by DROP NOT NULL;

ALTER TABLE public.sales 
  ALTER COLUMN recorded_by DROP NOT NULL;

ALTER TABLE public.expenses 
  ALTER COLUMN recorded_by DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restocking') THEN
    ALTER TABLE public.restocking 
    ALTER COLUMN recorded_by DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'waste_spoilage') THEN
    ALTER TABLE public.waste_spoilage 
    ALTER COLUMN recorded_by DROP NOT NULL;
  END IF;
END $$;
ALTER TABLE public.opening_stock 
  ALTER COLUMN recorded_by DROP NOT NULL;

ALTER TABLE public.closing_stock 
  ALTER COLUMN recorded_by DROP NOT NULL;

ALTER TABLE public.sales 
  ALTER COLUMN recorded_by DROP NOT NULL;

ALTER TABLE public.expenses 
  ALTER COLUMN recorded_by DROP NOT NULL;

-- Update restocking.recorded_by if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restocking') THEN
    ALTER TABLE public.restocking 
    ALTER COLUMN recorded_by DROP NOT NULL;
  END IF;
END $$;

-- Update waste_spoilage.recorded_by if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'waste_spoilage') THEN
    ALTER TABLE public.waste_spoilage 
    ALTER COLUMN recorded_by DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'opening_stock_recorded_by_fkey'
  ) THEN
    ALTER TABLE public.opening_stock 
    DROP CONSTRAINT opening_stock_recorded_by_fkey;
  END IF;
  
  ALTER TABLE public.opening_stock
  ADD CONSTRAINT opening_stock_recorded_by_fkey 
  FOREIGN KEY (recorded_by) 
  REFERENCES public.profiles(id) 
  ON DELETE SET NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'closing_stock_recorded_by_fkey'
  ) THEN
    ALTER TABLE public.closing_stock 
    DROP CONSTRAINT closing_stock_recorded_by_fkey;
  END IF;
  
  ALTER TABLE public.closing_stock
  ADD CONSTRAINT closing_stock_recorded_by_fkey 
  FOREIGN KEY (recorded_by) 
  REFERENCES public.profiles(id) 
  ON DELETE SET NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'sales_recorded_by_fkey'
  ) THEN
    ALTER TABLE public.sales 
    DROP CONSTRAINT sales_recorded_by_fkey;
  END IF;
  
  ALTER TABLE public.sales
  ADD CONSTRAINT sales_recorded_by_fkey 
  FOREIGN KEY (recorded_by) 
  REFERENCES public.profiles(id) 
  ON DELETE SET NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'expenses_recorded_by_fkey'
  ) THEN
    ALTER TABLE public.expenses 
    DROP CONSTRAINT expenses_recorded_by_fkey;
  END IF;
  
  ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_recorded_by_fkey 
  FOREIGN KEY (recorded_by) 
  REFERENCES public.profiles(id) 
  ON DELETE SET NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restocking') THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'restocking_recorded_by_fkey'
    ) THEN
      ALTER TABLE public.restocking 
      DROP CONSTRAINT restocking_recorded_by_fkey;
    END IF;
    
    ALTER TABLE public.restocking
    ADD CONSTRAINT restocking_recorded_by_fkey 
    FOREIGN KEY (recorded_by) 
    REFERENCES public.profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'waste_spoilage') THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'waste_spoilage_recorded_by_fkey'
    ) THEN
      ALTER TABLE public.waste_spoilage 
      DROP CONSTRAINT waste_spoilage_recorded_by_fkey;
    END IF;
    
    ALTER TABLE public.waste_spoilage
    ADD CONSTRAINT waste_spoilage_recorded_by_fkey 
    FOREIGN KEY (recorded_by) 
    REFERENCES public.profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'organizations_created_by_fkey'
  ) THEN
    ALTER TABLE public.organizations 
    DROP CONSTRAINT organizations_created_by_fkey;
  END IF;
END $$;

