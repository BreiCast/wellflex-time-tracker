# Generating Supabase Types

## Option 1: Using Supabase CLI (Recommended)

### Step 1: Install Supabase CLI (if not already installed)
```bash
npm install -g supabase
```

Or use npx (no installation needed):
```bash
npx supabase --version
```

### Step 2: Get your Supabase Access Token
1. Go to https://supabase.com/dashboard/account/tokens
2. Click "Generate new token"
3. Copy the token (you'll need it for the next step)

### Step 3: Generate Types
Run this command (replace `YOUR_ACCESS_TOKEN` with your token):

```bash
npx supabase gen types typescript \
  --project-id lgtzybhqelmbgovlhvqc \
  --schema public \
  > types/database.ts
```

You'll be prompted for your access token, or you can set it as an environment variable:
```bash
export SUPABASE_ACCESS_TOKEN=your_token_here
npx supabase gen types typescript --project-id lgtzybhqelmbgovlhvqc --schema public > types/database.ts
```

## Option 2: Using Supabase Dashboard

1. Go to your Supabase project: https://supabase.com/dashboard/project/lgtzybhqelmbgovlhvqc
2. Navigate to **Settings** → **API**
3. Scroll down to **Database Types**
4. Select **TypeScript**
5. Copy the generated types
6. Replace the contents of `types/database.ts` with the copied types

## After Generating Types

1. The types will be automatically picked up by your Supabase clients (they're already configured in `lib/supabase/server.ts` and `lib/supabase/client.ts`)
2. Run `npm run build` to verify everything compiles correctly
3. You can remove the `as any` type assertions we added earlier

