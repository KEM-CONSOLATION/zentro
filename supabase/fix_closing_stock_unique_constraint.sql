DO $$
DECLARE
    constraint_name TEXT;
    col1_name TEXT;
    col2_name TEXT;
BEGIN
  BEGIN
    ALTER TABLE public.closing_stock DROP CONSTRAINT IF EXISTS closing_stock_item_id_date_key;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.closing_stock'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 2
  LOOP
    SELECT attname INTO col1_name
    FROM pg_attribute
    WHERE attrelid = 'public.closing_stock'::regclass
      AND attnum = (
        SELECT conkey[1]
        FROM pg_constraint
        WHERE conname = constraint_name
        AND conrelid = 'public.closing_stock'::regclass
      );
    
    SELECT attname INTO col2_name
    FROM pg_attribute
    WHERE attrelid = 'public.closing_stock'::regclass
      AND attnum = (
        SELECT conkey[2]
        FROM pg_constraint
        WHERE conname = constraint_name
        AND conrelid = 'public.closing_stock'::regclass
      );
    
    IF (col1_name = 'item_id' AND col2_name = 'date') OR 
       (col1_name = 'date' AND col2_name = 'item_id') THEN
      EXECUTE 'ALTER TABLE public.closing_stock DROP CONSTRAINT ' || quote_ident(constraint_name);
      EXIT;
    END IF;
  END LOOP;
END $$;

DROP INDEX IF EXISTS idx_closing_stock_item_date_org;

UPDATE public.closing_stock 
SET organization_id = (
  SELECT organization_id 
  FROM public.profiles 
  WHERE id = closing_stock.recorded_by 
  LIMIT 1
)
WHERE organization_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'closing_stock_item_date_org_unique'
    AND conrelid = 'public.closing_stock'::regclass
  ) THEN
    ALTER TABLE public.closing_stock DROP CONSTRAINT closing_stock_item_date_org_unique;
  END IF;
  
  ALTER TABLE public.closing_stock 
  ADD CONSTRAINT closing_stock_item_date_org_unique 
  UNIQUE (item_id, date, organization_id);
END $$;

