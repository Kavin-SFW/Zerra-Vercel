-- =========================================================
-- Trigger to automatically create a user_profile on signup
-- =========================================================

-- 1. Create the function that runs when a user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent errors if profile already exists
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- 3. Backfill missing profiles (Self-Correction)
-- =========================================================
-- This part attempts to insert profiles for existing users who don't have one
-- We select from auth.users and insert into user_profiles if missing.

INSERT INTO public.user_profiles (id, email, full_name, created_at, updated_at)
SELECT 
    id, 
    email, 
    raw_user_meta_data->>'full_name', 
    created_at, 
    NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.user_profiles)
ON CONFLICT (id) DO NOTHING;
