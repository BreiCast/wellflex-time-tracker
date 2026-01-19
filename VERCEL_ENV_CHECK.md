# Vercel Environment Variables Checklist

## Required Environment Variables

Make sure these are set in your Vercel project settings:

### 1. Go to Vercel Dashboard
- Navigate to your project: https://vercel.com/dashboard
- Click on your project → **Settings** → **Environment Variables**

### 2. Add/Verify These Variables:

```bash
# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://lgtzybhqelmbgovlhvqc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Application URL (REQUIRED for email redirects)
NEXT_PUBLIC_APP_URL=https://tracker.wellflex.co
```

### 3. Important Notes:

- **All variables must be set for Production, Preview, and Development environments**
- After adding/updating variables, **redeploy your application** for changes to take effect
- The middleware error is usually caused by missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. How to Redeploy:

1. Go to your project's **Deployments** tab
2. Click the **"..."** menu on the latest deployment
3. Select **"Redeploy"**
4. Or push a new commit to trigger a new deployment

### 5. Verify Environment Variables:

After redeploying, check the build logs to ensure:
- No errors about missing environment variables
- Build completes successfully
- Middleware doesn't throw errors

## Troubleshooting

If you still get the middleware error after setting environment variables:

1. **Check Vercel logs**: Go to your project → **Logs** tab to see detailed error messages
2. **Verify variable names**: Make sure they match exactly (case-sensitive)
3. **Check for typos**: Especially in the Supabase URL
4. **Redeploy**: Environment variable changes require a new deployment

