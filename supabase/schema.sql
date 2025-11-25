-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('admin', 'staff');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Items/Inventory table
CREATE TABLE public.items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  unit TEXT NOT NULL DEFAULT 'pieces', -- e.g., 'kg', 'liters', 'pieces', 'bags'
  quantity INTEGER NOT NULL DEFAULT 0,
  cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Opening Stock table (start of day)
CREATE TABLE public.opening_stock (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  recorded_by UUID REFERENCES public.profiles(id) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(item_id, date) -- One opening stock per item per day
);

-- Closing Stock table (end of day)
CREATE TABLE public.closing_stock (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  recorded_by UUID REFERENCES public.profiles(id) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(item_id, date) -- One closing stock per item per day
);

-- Sales/Usage table (items used during sales)
CREATE TABLE public.sales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  price_per_unit DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'transfer')),
  date DATE NOT NULL,
  recorded_by UUID REFERENCES public.profiles(id) NOT NULL,
  description TEXT, -- e.g., "Rice, Egusi & Fufu"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Expenses table
CREATE TABLE public.expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  recorded_by UUID REFERENCES public.profiles(id) NOT NULL,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_opening_stock_date ON public.opening_stock(date);
CREATE INDEX idx_opening_stock_item ON public.opening_stock(item_id);
CREATE INDEX idx_closing_stock_date ON public.closing_stock(date);
CREATE INDEX idx_closing_stock_item ON public.closing_stock(item_id);
CREATE INDEX idx_sales_date ON public.sales(date);
CREATE INDEX idx_sales_item ON public.sales(item_id);
CREATE INDEX idx_expenses_date ON public.expenses(date);
CREATE INDEX idx_expenses_recorded_by ON public.expenses(recorded_by);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opening_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closing_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Function to check if user is admin (bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, anon;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    public.is_admin(auth.uid())
  );

CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (
    public.is_admin(auth.uid())
  );

-- Items policies (everyone can view, only admins can modify)
CREATE POLICY "Everyone can view items"
  ON public.items FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert items"
  ON public.items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update items"
  ON public.items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Opening stock policies
CREATE POLICY "Staff can view opening stock"
  ON public.opening_stock FOR SELECT
  USING (true);

CREATE POLICY "Staff can insert opening stock"
  ON public.opening_stock FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update opening stock"
  ON public.opening_stock FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete opening stock"
  ON public.opening_stock FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Closing stock policies
CREATE POLICY "Staff can view closing stock"
  ON public.closing_stock FOR SELECT
  USING (true);

CREATE POLICY "Staff can insert closing stock"
  ON public.closing_stock FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update closing stock"
  ON public.closing_stock FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete closing stock"
  ON public.closing_stock FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Sales policies
CREATE POLICY "Staff can view sales"
  ON public.sales FOR SELECT
  USING (true);

CREATE POLICY "Staff can insert sales"
  ON public.sales FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update sales"
  ON public.sales FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete sales"
  ON public.sales FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Expenses policies
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

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get email from the most reliable source
  user_email := COALESCE(
    NULLIF(NEW.email, ''),
    NEW.raw_user_meta_data->>'email',
    NEW.raw_user_meta_data->>'invite_email'
  );
  
  -- Ensure email is not NULL (required by schema)
  IF user_email IS NULL OR user_email = '' THEN
    user_email := 'user-' || NEW.id::TEXT || '@temp.local';
  END IF;
  
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    user_email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'staff')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(NULLIF(EXCLUDED.email, ''), profiles.email),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
    updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- If email already exists, try to update existing profile or use a variant
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      user_email || '-' || SUBSTRING(NEW.id::TEXT, 1, 8),
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), ''),
      COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'staff')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions to the function
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, anon, authenticated, service_role;

