-- Fix unique constraint for opening_stock to support organization_id
-- This migration removes the old constraint and creates a proper one that works with upsert

-- Step 1: Drop the old unique constraint if it exists
-- Try common constraint names first
DO $$
DECLARE
    constraint_name TEXT;
    col1_name TEXT;
    col2_name TEXT;
BEGIN
  -- Try dropping by common PostgreSQL-generated names
  BEGIN
    ALTER TABLE public.opening_stock DROP CONSTRAINT IF EXISTS opening_stock_item_id_date_key;
    RAISE NOTICE 'Dropped constraint: opening_stock_item_id_date_key';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- If that didn't work, find any unique constraint with exactly 2 columns
  -- and check if they are item_id and date
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.opening_stock'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 2
  LOOP
    -- Get the first column name
    SELECT attname INTO col1_name
    FROM pg_attribute
    WHERE attrelid = 'public.opening_stock'::regclass
      AND attnum = (
        SELECT conkey[1]
        FROM pg_constraint
        WHERE conname = constraint_name
        AND conrelid = 'public.opening_stock'::regclass
      );
    
    -- Get the second column name
    SELECT attname INTO col2_name
    FROM pg_attribute
    WHERE attrelid = 'public.opening_stock'::regclass
      AND attnum = (
        SELECT conkey[2]
        FROM pg_constraint
        WHERE conname = constraint_name
        AND conrelid = 'public.opening_stock'::regclass
      );
    
    -- Check if it matches item_id and date (in any order)
    IF (col1_name = 'item_id' AND col2_name = 'date') OR 
       (col1_name = 'date' AND col2_name = 'item_id') THEN
      EXECUTE 'ALTER TABLE public.opening_stock DROP CONSTRAINT ' || quote_ident(constraint_name);
      RAISE NOTICE 'Dropped constraint: % (columns: %, %)', constraint_name, col1_name, col2_name;
      EXIT;
    END IF;
  END LOOP;
END $$;

-- Step 2: Drop the partial unique index if it exists
DROP INDEX IF EXISTS idx_opening_stock_item_date_org;

-- Step 3: Update existing records with NULL organization_id
UPDATE public.opening_stock 
SET organization_id = (
  SELECT organization_id 
  FROM public.profiles 
  WHERE id = opening_stock.recorded_by 
  LIMIT 1
)
WHERE organization_id IS NULL;

-- Step 4: Create a unique constraint on (item_id, date, organization_id)
DO $$
BEGIN
  -- Drop the constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'opening_stock_item_date_org_unique'
    AND conrelid = 'public.opening_stock'::regclass
  ) THEN
    ALTER TABLE public.opening_stock DROP CONSTRAINT opening_stock_item_date_org_unique;
    RAISE NOTICE 'Dropped existing constraint: opening_stock_item_date_org_unique';
  END IF;
  
  -- Create the constraint
  ALTER TABLE public.opening_stock 
  ADD CONSTRAINT opening_stock_item_date_org_unique 
  UNIQUE (item_id, date, organization_id);
  
  RAISE NOTICE 'Created constraint: opening_stock_item_date_org_unique';
END $$;


