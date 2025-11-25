-- Add cost_price and selling_price columns to items table
-- This migration adds the cost_price and selling_price columns that replace price_per_unit

-- Add cost_price column if it doesn't exist
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Add selling_price column if it doesn't exist
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS selling_price DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- If price_per_unit exists, migrate its value to selling_price
-- Then drop price_per_unit if it exists
DO $$
BEGIN
  -- Check if price_per_unit column exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'items' 
    AND column_name = 'price_per_unit'
  ) THEN
    -- Migrate price_per_unit to selling_price where selling_price is 0
    UPDATE public.items 
    SET selling_price = price_per_unit 
    WHERE selling_price = 0 AND price_per_unit > 0;
    
    -- Drop the old price_per_unit column
    ALTER TABLE public.items DROP COLUMN IF EXISTS price_per_unit;
  END IF;
END $$;

-- Ensure payment_mode exists in sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'transfer'));

-- Add price fields to sales table if they don't exist
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS price_per_unit DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS total_price DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Update existing sales records to have default values if needed
UPDATE public.sales 
SET payment_mode = 'cash'
WHERE payment_mode IS NULL;

UPDATE public.sales 
SET price_per_unit = 0, total_price = 0 
WHERE price_per_unit IS NULL OR total_price IS NULL;

