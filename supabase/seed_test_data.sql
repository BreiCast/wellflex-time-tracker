-- Test Seed Script
-- Creates one admin user and one member user for testing
-- Run this after applying the main schema and migrations

-- Note: These users need to be created in Supabase Auth first
-- Then update the email addresses below to match your test users

-- Example: Create users in Supabase Auth dashboard first, then run:

-- Admin User (update email to match your test admin)
DO $$
DECLARE
  admin_user_id UUID;
  member_user_id UUID;
  test_team_id UUID;
BEGIN
  -- Get user IDs (update emails to match your test users)
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@test.com' LIMIT 1;
  SELECT id INTO member_user_id FROM auth.users WHERE email = 'member@test.com' LIMIT 1;

  -- Create users in public.users if they don't exist
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.users (id, email, full_name)
    VALUES (admin_user_id, 'admin@test.com', 'Test Admin')
    ON CONFLICT (id) DO UPDATE SET full_name = 'Test Admin';
  END IF;

  IF member_user_id IS NOT NULL THEN
    INSERT INTO public.users (id, email, full_name)
    VALUES (member_user_id, 'member@test.com', 'Test Member')
    ON CONFLICT (id) DO UPDATE SET full_name = 'Test Member';
  END IF;

  -- Create a test team
  INSERT INTO public.teams (name, color)
  VALUES ('Test Team', '#6366f1')
  ON CONFLICT (name) DO NOTHING
  RETURNING id INTO test_team_id;

  -- If team already exists, get its ID
  IF test_team_id IS NULL THEN
    SELECT id INTO test_team_id FROM public.teams WHERE name = 'Test Team' LIMIT 1;
  END IF;

  -- Add admin to team
  IF admin_user_id IS NOT NULL AND test_team_id IS NOT NULL THEN
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (test_team_id, admin_user_id, 'ADMIN')
    ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'ADMIN';
  END IF;

  -- Add member to team
  IF member_user_id IS NOT NULL AND test_team_id IS NOT NULL THEN
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (test_team_id, member_user_id, 'MEMBER')
    ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'MEMBER';
  END IF;

  -- Create notification preferences for users
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.notification_preferences (user_id, timezone)
    VALUES (admin_user_id, 'America/New_York')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  IF member_user_id IS NOT NULL THEN
    INSERT INTO public.notification_preferences (user_id, timezone)
    VALUES (member_user_id, 'America/New_York')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Create a sample schedule for member (Monday-Friday, 9am-5pm)
  IF member_user_id IS NOT NULL AND test_team_id IS NOT NULL THEN
    -- Monday
    INSERT INTO public.schedules (user_id, team_id, day_of_week, start_time, end_time, break_expected_minutes, is_active)
    VALUES (member_user_id, test_team_id, 1, '09:00:00', '17:00:00', 60, true)
    ON CONFLICT (user_id, team_id, day_of_week) DO UPDATE 
      SET start_time = '09:00:00', end_time = '17:00:00', break_expected_minutes = 60, is_active = true;

    -- Tuesday
    INSERT INTO public.schedules (user_id, team_id, day_of_week, start_time, end_time, break_expected_minutes, is_active)
    VALUES (member_user_id, test_team_id, 2, '09:00:00', '17:00:00', 60, true)
    ON CONFLICT (user_id, team_id, day_of_week) DO UPDATE 
      SET start_time = '09:00:00', end_time = '17:00:00', break_expected_minutes = 60, is_active = true;

    -- Wednesday
    INSERT INTO public.schedules (user_id, team_id, day_of_week, start_time, end_time, break_expected_minutes, is_active)
    VALUES (member_user_id, test_team_id, 3, '09:00:00', '17:00:00', 60, true)
    ON CONFLICT (user_id, team_id, day_of_week) DO UPDATE 
      SET start_time = '09:00:00', end_time = '17:00:00', break_expected_minutes = 60, is_active = true;

    -- Thursday
    INSERT INTO public.schedules (user_id, team_id, day_of_week, start_time, end_time, break_expected_minutes, is_active)
    VALUES (member_user_id, test_team_id, 4, '09:00:00', '17:00:00', 60, true)
    ON CONFLICT (user_id, team_id, day_of_week) DO UPDATE 
      SET start_time = '09:00:00', end_time = '17:00:00', break_expected_minutes = 60, is_active = true;

    -- Friday
    INSERT INTO public.schedules (user_id, team_id, day_of_week, start_time, end_time, break_expected_minutes, is_active)
    VALUES (member_user_id, test_team_id, 5, '09:00:00', '17:00:00', 60, true)
    ON CONFLICT (user_id, team_id, day_of_week) DO UPDATE 
      SET start_time = '09:00:00', end_time = '17:00:00', break_expected_minutes = 60, is_active = true;
  END IF;

  RAISE NOTICE 'Seed data created successfully';
  RAISE NOTICE 'Admin user ID: %', admin_user_id;
  RAISE NOTICE 'Member user ID: %', member_user_id;
  RAISE NOTICE 'Test team ID: %', test_team_id;
END $$;

-- Instructions:
-- 1. Create two test users in Supabase Auth dashboard:
--    - admin@test.com (password: your-choice)
--    - member@test.com (password: your-choice)
-- 2. Update the email addresses in the SELECT statements above
-- 3. Run this script in Supabase SQL Editor
-- 4. The script will create:
--    - User records in public.users
--    - A test team
--    - Team memberships (admin and member)
--    - Notification preferences
--    - Sample schedules (Mon-Fri, 9am-5pm)
