# Setting Environment Variables in Vercel

## Step-by-Step Instructions

### 1. Access Your Vercel Project
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Find and click on your project (likely named `wellflex-time-tracker` or similar)

### 2. Navigate to Environment Variables
1. Click on **Settings** (in the top navigation)
2. Click on **Environment Variables** (in the left sidebar)

### 3. Add Required Variables

You need to add these **4 environment variables**:

#### Variable 1: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://lgtzybhqelmbgovlhvqc.supabase.co`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development

#### Variable 2: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: Your Supabase Anon Key (get it from Supabase Dashboard)
- **How to find it**:
  1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
  2. Select your project
  3. Go to **Settings** → **API**
  4. Copy the **anon/public** key
- **Environments**: ✅ Production, ✅ Preview, ✅ Development

#### Variable 3: `SUPABASE_SERVICE_ROLE_KEY`
- **Value**: Your Supabase Service Role Key (get it from Supabase Dashboard)
- **How to find it**:
  1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
  2. Select your project
  3. Go to **Settings** → **API**
  4. Copy the **service_role** key (⚠️ Keep this secret!)
- **Environments**: ✅ Production, ✅ Preview, ✅ Development
- **Note**: This is a sensitive key - never expose it in client-side code

#### Variable 4: `NEXT_PUBLIC_APP_URL`
- **Value**: `https://tracker.wellflex.co` (or your actual production URL)
- **Environments**: ✅ Production, ✅ Preview, ✅ Development
- **Note**: For preview deployments, Vercel will use the preview URL automatically

### 4. Adding Variables in Vercel

For each variable:
1. Click **"Add New"** button
2. Enter the **Key** (variable name)
3. Enter the **Value** (the actual value)
4. Select which **Environments** to apply it to:
   - ✅ Production
   - ✅ Preview  
   - ✅ Development
5. Click **"Save"**

### 5. After Adding Variables

**IMPORTANT**: Environment variable changes require a new deployment!

1. Go to the **Deployments** tab
2. Find your latest deployment
3. Click the **"..."** menu (three dots)
4. Select **"Redeploy"**
5. Confirm the redeploy

Alternatively, you can push a new commit to trigger a deployment:
```bash
git commit --allow-empty -m "Trigger redeploy for environment variables"
git push
```

### 6. Verify Variables Are Set

After redeploying:
1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click on **"Build Logs"** or **"Function Logs"**
4. Check that there are no errors about missing environment variables

### 7. Test the Application

1. Visit your production URL: `https://tracker.wellflex.co`
2. Check the browser console (F12 → Console) for any errors
3. Try logging in or signing up
4. If you see errors, check the Vercel logs for more details

## Quick Checklist

- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set
- [ ] `NEXT_PUBLIC_APP_URL` is set
- [ ] All variables are enabled for Production, Preview, and Development
- [ ] Redeployed the application after adding variables
- [ ] Tested the application and it's working

## Troubleshooting

### Still seeing errors?
1. **Check Vercel Logs**: Go to your project → **Logs** tab to see detailed error messages
2. **Verify variable names**: They must match exactly (case-sensitive, no typos)
3. **Check Supabase Dashboard**: Make sure your Supabase project is active and the keys are correct
4. **Clear browser cache**: Sometimes cached errors can persist

### Common Issues

**"Missing Supabase environment variables"**
- Make sure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Redeploy after adding them

**"500 Internal Server Error"**
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set
- Check Vercel logs for specific error messages

**"Page stuck loading"**
- Check browser console for errors
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
- Check network tab to see if requests are failing

