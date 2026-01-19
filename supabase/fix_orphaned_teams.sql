-- Fix teams that were created but user wasn't added to team_members
-- This will add you to any teams you created but aren't a member of

-- Find teams you created but aren't a member of
-- Replace 'YOUR_USER_ID' with your actual user ID from auth.users

-- Option 1: Add yourself to all teams you created (if you can identify them)
-- This assumes you know which teams are yours
INSERT INTO public.team_members (team_id, user_id, role)
SELECT 
  t.id,
  'YOUR_USER_ID'::UUID,  -- Replace with your user ID
  'ADMIN'
FROM public.teams t
WHERE t.id NOT IN (
  SELECT team_id 
  FROM public.team_members 
  WHERE user_id = 'YOUR_USER_ID'::UUID  -- Replace with your user ID
)
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Option 2: List all teams and their members to see what's missing
SELECT 
  t.id as team_id,
  t.name as team_name,
  t.created_at,
  COUNT(tm.id) as member_count,
  STRING_AGG(u.email, ', ') as member_emails
FROM public.teams t
LEFT JOIN public.team_members tm ON t.id = tm.team_id
LEFT JOIN public.users u ON tm.user_id = u.id
GROUP BY t.id, t.name, t.created_at
ORDER BY t.created_at DESC;

-- Option 3: Delete orphaned teams (teams with no members)
-- WARNING: This will delete teams that have no members
-- DELETE FROM public.teams
-- WHERE id NOT IN (SELECT DISTINCT team_id FROM public.team_members);

