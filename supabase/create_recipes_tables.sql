-- Recipes table (links menu items to recipes)
CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  serving_size INTEGER NOT NULL DEFAULT 1, -- Number of servings this recipe makes
  preparation_time INTEGER, -- in minutes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(menu_item_id) -- One recipe per menu item
);

-- Recipe Ingredients table (maps items to recipes with quantities)
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE RESTRICT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL, -- Quantity needed per serving
  unit TEXT NOT NULL, -- Unit of measurement (should match item.unit)
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(recipe_id, item_id) -- One entry per ingredient per recipe
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recipes_menu_item ON public.recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON public.recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_item ON public.recipe_ingredients(item_id);

-- Enable RLS
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- Recipes policies
CREATE POLICY "Staff can view recipes"
  ON public.recipes FOR SELECT
  USING (true);

CREATE POLICY "Staff can insert recipes"
  ON public.recipes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update recipes"
  ON public.recipes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete recipes"
  ON public.recipes FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Recipe ingredients policies
CREATE POLICY "Staff can view recipe ingredients"
  ON public.recipe_ingredients FOR SELECT
  USING (true);

CREATE POLICY "Staff can insert recipe ingredients"
  ON public.recipe_ingredients FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update recipe ingredients"
  ON public.recipe_ingredients FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete recipe ingredients"
  ON public.recipe_ingredients FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

