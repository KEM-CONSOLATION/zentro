-- Add batch tracking fields to sales table
-- This allows tracking which restocking batch or opening stock batch was sold
-- When items are restocked with different prices, they are treated as separate batches

ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS restocking_id UUID REFERENCES public.restocking(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS opening_stock_id UUID REFERENCES public.opening_stock(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS batch_label TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_restocking ON public.sales(restocking_id);
CREATE INDEX IF NOT EXISTS idx_sales_opening_stock ON public.sales(opening_stock_id);

-- Add comment explaining the batch tracking
COMMENT ON COLUMN public.sales.restocking_id IS 'References the restocking batch that was sold. NULL if sold from opening stock.';
COMMENT ON COLUMN public.sales.opening_stock_id IS 'References the opening stock batch that was sold. NULL if sold from restocking.';
COMMENT ON COLUMN public.sales.batch_label IS 'Human-readable label for the batch (e.g., "Old Price (₦100)" or "New Price (₦150)")';

