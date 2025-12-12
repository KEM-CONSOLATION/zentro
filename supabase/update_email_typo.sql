-- =====================================================
-- UPDATE EMAIL TYPO: lacuisine@coundpadi.com -> lacuisine@countpadi.com
-- =====================================================
-- This script fixes the typo in the email address
-- Updates both auth.users and profiles tables
-- =====================================================

DO $$
DECLARE
  old_email TEXT := 'lacuisine@coundpadi.com';  -- Old email with typo
  new_email TEXT := 'lacuisine@countpadi.com';  -- Correct email
  user_id_found UUID;
  profiles_updated INTEGER := 0;
  auth_users_updated INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'UPDATING EMAIL TYPO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Old Email: %', old_email;
  RAISE NOTICE 'New Email: %', new_email;
  RAISE NOTICE '';

  -- STEP 1: Find user in auth.users
  SELECT id INTO user_id_found
  FROM auth.users
  WHERE email = LOWER(old_email)
  LIMIT 1;

  IF user_id_found IS NULL THEN
    RAISE NOTICE '⚠️  User not found with email: %', old_email;
    RAISE NOTICE 'Checking if correct email already exists...';
    
    -- Check if correct email already exists
    SELECT id INTO user_id_found
    FROM auth.users
    WHERE email = LOWER(new_email)
    LIMIT 1;
    
    IF user_id_found IS NOT NULL THEN
      RAISE NOTICE '✅ Correct email already exists. User ID: %', user_id_found;
      RAISE NOTICE 'No update needed.';
    ELSE
      RAISE EXCEPTION 'User not found with email: %. Nothing to update.', old_email;
    END IF;
  ELSE
    RAISE NOTICE '✅ Found user with old email. User ID: %', user_id_found;
    
    -- STEP 2: Check if new email already exists (conflict check)
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = LOWER(new_email) AND id != user_id_found) THEN
      RAISE EXCEPTION 'Email % already exists for another user. Cannot update.', new_email;
    END IF;

    -- STEP 3: Update auth.users
    UPDATE auth.users
    SET 
      email = LOWER(new_email),
      updated_at = NOW()
    WHERE id = user_id_found;
    
    GET DIAGNOSTICS auth_users_updated = ROW_COUNT;
    
    IF auth_users_updated > 0 THEN
      RAISE NOTICE '✅ Updated auth.users email';
    ELSE
      RAISE NOTICE '⚠️  No rows updated in auth.users';
    END IF;

    -- STEP 4: Update profiles table
    UPDATE public.profiles
    SET 
      email = LOWER(new_email),
      updated_at = NOW()
    WHERE id = user_id_found;
    
    GET DIAGNOSTICS profiles_updated = ROW_COUNT;
    
    IF profiles_updated > 0 THEN
      RAISE NOTICE '✅ Updated profiles email';
    ELSE
      RAISE NOTICE '⚠️  No rows updated in profiles (profile might not exist)';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ SUMMARY:';
    RAISE NOTICE '   auth.users updated: %', auth_users_updated;
    RAISE NOTICE '   profiles updated: %', profiles_updated;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Email updated successfully!';
    RAISE NOTICE '   User can now login with: %', new_email;
  END IF;

END $$;

-- =====================================================
-- VERIFICATION: Check the updated email
-- =====================================================

-- Verify auth.users
SELECT 
  id,
  email,
  created_at,
  updated_at
FROM auth.users
WHERE email = 'lacuisine@countpadi.com';

-- Verify profiles
SELECT 
  id,
  email,
  full_name,
  role,
  organization_id,
  updated_at
FROM public.profiles
WHERE email = 'lacuisine@countpadi.com';
