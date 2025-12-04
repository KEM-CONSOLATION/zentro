-- Waste/Spoilage table (tracks items lost to waste or spoilage)
CREATE TABLE IF NOT EXISTS public.waste_spoilage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('waste', 'spoilage')), -- Type of loss
  reason TEXT, -- Reason for waste/spoilage (e.g., "Expired", "Damaged", "Overcooked")
  recorded_by UUID REFERENCES public.profiles(id) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_waste_spoilage_date ON public.waste_spoilage(date);
CREATE INDEX IF NOT EXISTS idx_waste_spoilage_item ON public.waste_spoilage(item_id);
CREATE INDEX IF NOT EXISTS idx_waste_spoilage_type ON public.waste_spoilage(type);

-- Enable RLS
ALTER TABLE public.waste_spoilage ENABLE ROW LEVEL SECURITY;

-- Waste/Spoilage policies
CREATE POLICY "Staff can view waste/spoilage"
  ON public.waste_spoilage FOR SELECT
  USING (true);

CREATE POLICY "Staff can insert waste/spoilage"
  ON public.waste_spoilage FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update waste/spoilage"
  ON public.waste_spoilage FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete waste/spoilage"
  ON public.waste_spoilage FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

