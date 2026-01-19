# Supabase Email Configuration for Production

## Important: Two Places to Configure Email URLs

When emails are sent, Supabase uses **both**:
1. The `emailRedirectTo` parameter in your code (which we just fixed)
2. The **Site URL** and **Redirect URLs** in Supabase Dashboard

## Step 1: Update Supabase Dashboard Settings

### 1. Go to Supabase Dashboard
- Navigate to: https://supabase.com/dashboard/project/lgtzybhqelmbgovlhvqc

### 2. Set Site URL
1. Go to **Settings** → **API**
2. Find **"Site URL"** section
3. Set it to: `https://tracker.wellflex.co`
4. Click **"Save"**

### 3. Add Redirect URLs
1. Still in **Settings** → **API**
2. Scroll to **"Redirect URLs"** section
3. Add these URLs (one per line):
   ```
   https://tracker.wellflex.co/auth/confirm
   https://tracker.wellflex.co/auth/accept-invite
   http://localhost:3000/auth/confirm
   http://localhost:3000/auth/accept-invite
   ```
4. Click **"Save"**

### 4. Update Email Templates (Optional but Recommended)
1. Go to **Authentication** → **Email Templates**
2. Click on **"Confirm signup"** template
3. Make sure the template uses `{{ .ConfirmationURL }}` (this will use the correct URL)
4. Example template:
   ```html
   <h2>Welcome to Time Tracker!</h2>
   <p>Click the link below to confirm your email address:</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm Email Address</a></p>
   <p>Or copy and paste this URL into your browser:</p>
   <p>{{ .ConfirmationURL }}</p>
   ```

## Step 2: Verify Environment Variable in Vercel

Make sure `NEXT_PUBLIC_APP_URL` is set in Vercel:
- Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- Verify `NEXT_PUBLIC_APP_URL` = `https://tracker.wellflex.co`
- **Redeploy** after setting/updating this variable

## How It Works

1. **Code sends email**: Your API route sets `emailRedirectTo` using `NEXT_PUBLIC_APP_URL`
2. **Supabase generates link**: Supabase uses the **Site URL** from dashboard as the base
3. **Final URL**: Supabase combines Site URL + redirect path to create the confirmation link

**Important**: If Supabase Dashboard Site URL is still set to `http://localhost:3000`, it will override your code's `emailRedirectTo` parameter!

## Testing

After updating both:
1. Sign up a new user
2. Check the email
3. Verify the confirmation link points to `https://tracker.wellflex.co/auth/confirm?token=...`
4. Not `http://localhost:3000/auth/confirm?token=...`

## Troubleshooting

**Links still showing localhost?**
- ✅ Check Supabase Dashboard → Settings → API → Site URL
- ✅ Check Supabase Dashboard → Settings → API → Redirect URLs
- ✅ Check Vercel Environment Variables → `NEXT_PUBLIC_APP_URL`
- ✅ Redeploy after making changes

**Links not working?**
- Make sure the redirect URL is in the "Redirect URLs" list in Supabase
- Check that the URL matches exactly (including https://)
- Verify the route `/auth/confirm` exists and works

