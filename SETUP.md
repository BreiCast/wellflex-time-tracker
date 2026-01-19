# Setup Instructions

## Step 1: Run the SQL Schema in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the entire contents of `supabase/schema.sql`
5. Paste it into the SQL editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. Verify all tables, triggers, and policies were created successfully

## Step 1b: Run the Trigger Script (IMPORTANT!)

**You MUST run this after the schema!**

1. In SQL Editor, click **New Query**
2. Copy the entire contents of `supabase/triggers.sql`
3. Paste it into the SQL editor
4. Click **Run**

This creates triggers that automatically create `public.users` records when users sign up. **Without this, you'll get foreign key constraint errors!**

## Step 2: Get Your Supabase Keys

1. In your Supabase project dashboard, go to **Settings** (gear icon)
2. Click on **API** in the left sidebar
3. You'll see:
   - **Project URL** - This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key - This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key - This is your `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

## Step 3: Create .env.local File

1. In the project root, create a file named `.env.local`
2. Copy the contents from `.env.local.example`
3. Replace the placeholder values with your actual Supabase keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 4: Verify Setup

1. Make sure `.env.local` is in your `.gitignore` (it should be)
2. Restart your development server if it's running:
   ```bash
   npm run dev
   ```

## Important Notes

- ⚠️ **Never commit `.env.local` to git** - it contains sensitive keys
- The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS - keep it secret!
- The `NEXT_PUBLIC_*` variables are safe to expose (they're used client-side)
- After running the schema, you can create your first user via the signup page

## Testing the Setup

1. Start the dev server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. You should be redirected to `/login`
4. Create a test account
5. After signup, you'll need to manually add yourself to a team in Supabase (or create a team via SQL)

### Quick Test: Create a Team and Add Yourself

Run this in Supabase SQL Editor (replace `YOUR_USER_ID` with your actual user ID from auth.users):

```sql
-- Create a test team
INSERT INTO public.teams (name) VALUES ('Test Team') RETURNING id;

-- Add yourself as admin (replace YOUR_USER_ID and TEAM_ID)
INSERT INTO public.team_members (team_id, user_id, role)
VALUES ('TEAM_ID_FROM_ABOVE', 'YOUR_USER_ID', 'ADMIN');
```

You can find your user ID in Supabase: **Authentication** → **Users** → Click on your user → Copy the UUID

