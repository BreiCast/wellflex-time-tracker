# Production Deployment Checklist

## Pre-Deployment Checklist

### 1. Environment Variables
Ensure all environment variables are set in your production environment:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key

# Application URL (for email redirects)
# Use your subdomain: tracker.wellflex.co
NEXT_PUBLIC_APP_URL=https://tracker.wellflex.co
```

**Important:** 
- Never commit `.env` files to Git (already in `.gitignore`)
- Set these in your hosting platform's environment variables (Vercel, Netlify, etc.)

### 2. Database Setup
Run the following SQL scripts in your production Supabase database in order:

1. `supabase/schema.sql` - Main schema with all tables, RLS policies, and triggers
2. `supabase/triggers.sql` - User sync triggers
3. `supabase/add_break_types.sql` - Break type enum (if not in schema.sql)
4. `supabase/add_team_features.sql` - Team colors and schedules (if not in schema.sql)

**Note:** Check if some features are already in `schema.sql` to avoid duplicate errors.

### 3. Supabase Configuration

#### Email Settings
- Configure SMTP in Supabase Dashboard → Authentication → Email Templates
- Update email redirect URLs to point to your production domain
- Test email confirmation flow

#### Row Level Security (RLS)
- Verify all RLS policies are enabled
- Test with different user roles (MEMBER, MANAGER, ADMIN)

### 4. Application URL Configuration

Update email redirect URLs in:
- `app/api/auth/signup/route.ts` - Check `emailRedirectTo` uses `NEXT_PUBLIC_APP_URL`
- Supabase Dashboard → Authentication → URL Configuration

### 5. Build & Test

```bash
# Test production build locally
npm run build
npm run start

# Test that all routes work
# - Sign up flow
# - Login flow
# - Email confirmation
# - Time tracking
# - Team management
```

### 6. Security Checklist

- [ ] All environment variables are set (not hardcoded)
- [ ] `.env` files are in `.gitignore` ✅
- [ ] Service role key is only used server-side ✅
- [ ] RLS policies are enabled and tested
- [ ] Email confirmation is working
- [ ] HTTPS is enabled (automatic on Vercel/Netlify)

### 7. Performance

- [ ] Images optimized (if any added later)
- [ ] Database indexes are appropriate
- [ ] API routes are optimized

### 8. Monitoring & Logging

Consider adding:
- Error tracking (Sentry, etc.)
- Analytics (if needed)
- Logging for critical operations

## Deployment Platforms

### Vercel (Recommended for Next.js)

#### Initial Setup

1. **Connect your GitHub repository:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your GitHub repository: `BreiCast/wellflex-time-tracker`
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `./` (default)

2. **Set environment variables in Vercel Dashboard:**
   - Go to Project Settings → Environment Variables
   - Add all required variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
     SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
     NEXT_PUBLIC_APP_URL=https://tracker.wellflex.co
     ```

3. **Deploy:**
   - Click "Deploy"
   - Vercel will automatically build and deploy

#### Setting Up Subdomain (tracker.wellflex.co)

1. **Add Domain in Vercel:**
   - Go to your project → Settings → Domains
   - Click "Add Domain"
   - Enter: `tracker.wellflex.co`
   - Click "Add"

2. **Configure DNS (if not already done):**
   - Go to your DNS provider (where wellflex.co is managed)
   - Add a CNAME record:
     - **Name/Host:** `tracker`
     - **Value/Target:** `cname.vercel-dns.com`
     - **TTL:** 3600 (or default)

3. **Verify Domain:**
   - Vercel will automatically verify the domain
   - This may take a few minutes to propagate

4. **Update Supabase Redirect URLs:**
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Add to "Redirect URLs": `https://tracker.wellflex.co/auth/confirm`
   - Add to "Site URL": `https://tracker.wellflex.co`

#### Using Vercel CLI (Optional)

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link to your project (from project directory)
vercel link

# Deploy to production
vercel --prod
```

### Netlify

1. Connect GitHub repository
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Set environment variables

### Other Platforms

Ensure:
- Node.js 18+ is available
- Build command: `npm run build`
- Start command: `npm run start`
- Environment variables are configured

## Post-Deployment

1. **Test Production Flow:**
   - [ ] Sign up new user
   - [ ] Confirm email
   - [ ] Login
   - [ ] Create team
   - [ ] Clock in/out
   - [ ] Switch teams
   - [ ] Create schedule
   - [ ] View progress bars

2. **Update Documentation:**
   - Update README with production URL
   - Document any production-specific configurations

3. **Set up CI/CD:**
   - Automatic deployments on push to `main`
   - Run tests before deployment (if you add tests)

## Troubleshooting

### Common Issues

1. **Email confirmation not working:**
   - Check `NEXT_PUBLIC_APP_URL` is set correctly
   - Verify Supabase email redirect URL configuration

2. **Database errors:**
   - Ensure all migrations are run
   - Check RLS policies are correct

3. **Build errors:**
   - Check all environment variables are set
   - Verify TypeScript compilation passes

## Support

For issues, check:
- Supabase Dashboard logs
- Vercel/Netlify build logs
- Browser console for client-side errors

