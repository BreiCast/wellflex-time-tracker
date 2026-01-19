-- Quick fix: Add yourself to teams you're not a member of
-- This will find your user ID and add you to any teams you're missing from

-- Step 1: Find your user ID
SELECT id, email FROM auth.users WHERE email = 'breider@wellflex.co';

-- Step 2: Add yourself to all teams (replace YOUR_USER_ID with the ID from Step 1)
-- Or use this version that finds your ID automatically:
INSERT INTO public.team_members (team_id, user_id, role)
SELECT 
  t.id,
  (SELECT id FROM auth.users WHERE email = 'breider@wellflex.co')::UUID,
  'ADMIN'
FROM public.teams t
WHERE t.id NOT IN (
  SELECT team_id 
  FROM public.team_members 
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'breider@wellflex.co')::UUID
)
ON CONFLICT (team_id, user_id) DO NOTHING
RETURNING *;

-- Step 3: Verify you're now a member
SELECT 
  t.name as team_name,
  tm.role,
  u.email
FROM public.team_members tm
JOIN public.teams t ON tm.team_id = t.id
JOIN public.users u ON tm.user_id = u.id
WHERE u.email = 'breider@wellflex.co';

