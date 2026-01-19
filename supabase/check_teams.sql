-- Check teams and their members (no schema changes, safe to run)
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

-- Check your specific teams
SELECT 
  t.id as team_id,
  t.name as team_name,
  tm.role,
  u.email as your_email,
  CASE WHEN tm.id IS NULL THEN 'NOT A MEMBER' ELSE 'MEMBER' END as status
FROM public.teams t
LEFT JOIN public.team_members tm ON t.id = tm.team_id AND tm.user_id = (SELECT id FROM auth.users WHERE email = 'breider@wellflex.co')
LEFT JOIN public.users u ON tm.user_id = u.id
WHERE t.name LIKE '%Aclarian%' OR t.name LIKE '%Team%'
ORDER BY t.created_at DESC;

