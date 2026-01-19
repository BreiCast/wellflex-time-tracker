# Database Setup Instructions

## Important: Run These SQL Scripts in Order

### Step 1: Run the Main Schema

1. Go to Supabase Dashboard → SQL Editor
2. Open `supabase/schema.sql`
3. Copy the entire file
4. Paste into SQL Editor
5. Click **Run**

This creates all tables, constraints, RLS policies, and triggers.

### Step 2: Run the Trigger Script (IMPORTANT!)

After running the main schema, you **MUST** run the trigger script:

1. Go to Supabase Dashboard → SQL Editor
2. Open `supabase/triggers.sql`
3. Copy the entire file
4. Paste into SQL Editor
5. Click **Run**

This creates triggers that automatically create `public.users` records when users sign up in `auth.users`.

## What the Triggers Do

The triggers automatically:
- Create a `public.users` record when a new user signs up in `auth.users`
- Update the `public.users` email if it changes in `auth.users`
- Prevent foreign key constraint errors

## Verify Setup

After running both scripts, verify:

1. **Check tables exist:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```
   Should show: `adjustments`, `audit_logs`, `break_segments`, `notes`, `requests`, `team_members`, `teams`, `time_sessions`, `users`

2. **Check triggers exist:**
   ```sql
   SELECT trigger_name, event_object_table
   FROM information_schema.triggers
   WHERE trigger_schema = 'public' OR event_object_schema = 'auth';
   ```
   Should show triggers on `auth.users`

3. **Test user creation:**
   - Sign up a new user
   - Check if record appears in `public.users`:
   ```sql
   SELECT * FROM public.users;
   ```

## Troubleshooting

### "relation does not exist" error
- Make sure you ran `schema.sql` first
- Check that you're in the correct database

### "permission denied" error
- Make sure you're using the SQL Editor in Supabase Dashboard
- The service role has the necessary permissions

### Foreign key constraint errors persist
- Make sure `triggers.sql` was run
- Check that triggers are active:
  ```sql
  SELECT * FROM pg_trigger WHERE tgname LIKE '%user%';
  ```

### Users not being created automatically
- Verify the trigger exists:
  ```sql
  SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
  ```
- Check trigger function:
  ```sql
  SELECT * FROM pg_proc WHERE proname = 'handle_new_user';
  ```

## Manual User Creation (If Needed)

If a user exists in `auth.users` but not in `public.users`, you can manually create it:

```sql
INSERT INTO public.users (id, email, full_name)
SELECT 
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users);
```

This will create records for all users in `auth.users` that don't have a `public.users` record.

