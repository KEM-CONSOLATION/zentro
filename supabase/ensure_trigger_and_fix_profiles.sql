-- Ensure the trigger function exists and is correct
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
BEGIN
  user_email := COALESCE(
    NULLIF(NEW.email, ''),
    NEW.raw_user_meta_data->>'email',
    NEW.raw_user_meta_data->>'invite_email'
  );
  
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
    role = COALESCE((NEW.raw_user_meta_data->>'role')::user_role, profiles.role),
    updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists and recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, anon, authenticated, service_role;

-- Create profiles for any existing users in auth.users that don't have profiles
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
  au.id,
  COALESCE(NULLIF(au.email, ''), 'user-' || au.id::TEXT || '@temp.local'),
  COALESCE(NULLIF(au.raw_user_meta_data->>'full_name', ''), ''),
  COALESCE((au.raw_user_meta_data->>'role')::user_role, 'staff')
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

