-- Fix existing users: Create public.users records for all auth.users that don't have one
-- Run this if you have existing users in auth.users but not in public.users

INSERT INTO public.users (id, email, full_name)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', NULL) as full_name
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- Verify the fix worked
SELECT 
  'auth.users count' as source,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'public.users count' as source,
  COUNT(*) as count
FROM public.users;

-- Show any users still missing (should be empty)
SELECT 
  au.id,
  au.email,
  'Missing from public.users' as issue
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

