# Email Setup Guide for Supabase

## Step 1: Enable Email Confirmation in Supabase

1. Go to your **Supabase Dashboard**
2. Navigate to **Authentication** → **Settings**
3. Scroll down to **Email Auth** section
4. Make sure **"Enable email confirmations"** is **ON** (toggle enabled)
5. Scroll down to **Email Templates** section

## Step 2: Configure Email Provider

You have two options:

### Option A: Use Supabase's Default Email Service (Free, Limited)

- Supabase provides a default email service
- **Rate limits**: 3 emails per hour per user
- Good for development and testing
- No additional setup required

### Option B: Use Custom SMTP (Recommended for Production)

1. In Supabase Dashboard, go to **Settings** → **Auth**
2. Scroll to **SMTP Settings**
3. Enable **"Enable Custom SMTP"**
4. Fill in your SMTP provider details:
   - **SMTP Host**: e.g., `smtp.gmail.com`, `smtp.sendgrid.net`, etc.
   - **SMTP Port**: e.g., `587` (TLS) or `465` (SSL)
   - **SMTP User**: Your SMTP username
   - **SMTP Password**: Your SMTP password
   - **Sender Email**: The email address that will send emails
   - **Sender Name**: Display name for emails

#### Popular SMTP Providers:

**SendGrid:**
- Host: `smtp.sendgrid.net`
- Port: `587`
- User: `apikey`
- Password: Your SendGrid API key

**Gmail (with App Password):**
- Host: `smtp.gmail.com`
- Port: `587`
- User: Your Gmail address
- Password: App-specific password (not your regular password)

**Mailgun:**
- Host: `smtp.mailgun.org`
- Port: `587`
- User: Your Mailgun SMTP username
- Password: Your Mailgun SMTP password

**AWS SES:**
- Host: `email-smtp.[region].amazonaws.com`
- Port: `587`
- User: Your AWS SES SMTP username
- Password: Your AWS SES SMTP password

**Zoho Mail:**
- Host: `smtp.zoho.com` (or `smtp.zoho.eu` for EU, `smtp.zoho.in` for India)
- Port: `587` (TLS) or `465` (SSL)
- User: Your full Zoho email address (e.g., `yourname@zoho.com`)
- Password: Your Zoho account password (or App Password if 2FA is enabled)
- **Note**: You may need to enable "Less Secure Apps" or create an App Password if 2FA is enabled

## Step 3: Customize Email Templates (Optional)

1. In Supabase Dashboard, go to **Authentication** → **Email Templates**
2. You can customize:
   - **Confirm signup** - Email sent when user signs up
   - **Magic Link** - Email for passwordless login
   - **Change Email Address** - Email when email is changed
   - **Reset Password** - Email for password reset

3. Click on **"Confirm signup"** template
4. Customize the subject and body as needed
5. Available variables:
   - `{{ .ConfirmationURL }}` - The confirmation link
   - `{{ .Email }}` - User's email
   - `{{ .Token }}` - Confirmation token
   - `{{ .TokenHash }}` - Hashed token
   - `{{ .SiteURL }}` - Your site URL

### Example Email Template:

**Subject:** `Confirm your signup`

**Body:**
```html
<h2>Welcome!</h2>
<p>Follow this link to confirm your user:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
```

## Step 4: Set Site URL

1. In Supabase Dashboard, go to **Settings** → **API**
2. Under **Project URL**, set your site URL:
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`

3. Add **Redirect URLs**:
   - `http://localhost:3000/auth/confirm`
   - `http://localhost:3000/auth/accept-invite`
   - `https://yourdomain.com/auth/confirm`
   - `https://yourdomain.com/auth/accept-invite`

## Step 5: Update Environment Variables

Make sure your `.env.local` includes:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # Add this for production
```

## Step 6: Test Email Confirmation

1. Start your dev server: `npm run dev`
2. Go to signup page
3. Create a new account
4. Check your email inbox (and spam folder)
5. Click the confirmation link
6. You should be redirected to the dashboard

## Troubleshooting

### Emails not sending?
- Check SMTP settings are correct
- Verify sender email is verified (for some providers)
- Check Supabase logs: **Logs** → **Auth Logs**

### Confirmation link not working?
- Verify redirect URLs are set in Supabase settings
- Check that `NEXT_PUBLIC_SITE_URL` matches your actual URL
- Make sure the confirmation route handler is working

### Rate limiting?
- Supabase default email service has rate limits
- Use custom SMTP for higher limits
- Or wait for the rate limit to reset

## Production Checklist

- [ ] Custom SMTP configured
- [ ] Email templates customized
- [ ] Site URL set correctly
- [ ] Redirect URLs configured
- [ ] Tested email delivery
- [ ] Tested confirmation flow
- [ ] Error handling in place

