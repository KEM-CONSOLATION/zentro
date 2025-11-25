-- Add payment mode to sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'transfer'));

-- Change items table: replace price_per_unit with cost_price and selling_price
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS selling_price DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Migrate existing price_per_unit to selling_price
UPDATE public.items 
SET selling_price = price_per_unit 
WHERE price_per_unit > 0 AND selling_price = 0;

-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  recorded_by UUID REFERENCES public.profiles(id) NOT NULL,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_recorded_by ON public.expenses(recorded_by);

-- Enable RLS on expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies for expenses
CREATE POLICY "Users can view expenses"
  ON public.expenses FOR SELECT
  USING (true);

CREATE POLICY "Users can insert expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = recorded_by);

CREATE POLICY "Admins can update expenses"
  ON public.expenses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete expenses"
  ON public.expenses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

