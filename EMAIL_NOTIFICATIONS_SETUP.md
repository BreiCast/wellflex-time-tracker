# Email Notifications Setup

This application sends email notifications to administrators and requesters using the same SMTP configuration as Supabase.

## Setup Instructions

### 1. Install Nodemailer Package

```bash
npm install nodemailer
```

### 2. Configure SMTP Environment Variables

Since you're already using Zoho SMTP in Supabase, use the same credentials. Add these environment variables to your `.env.local` file (for local development) and to your Vercel project settings (for production):

```env
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_USER=your-email@zoho.com
SMTP_PASSWORD=your-zoho-password-or-app-password
SMTP_FROM_EMAIL=Time Tracker <your-email@zoho.com>
```

**Note:** 
- Use the same SMTP credentials that are configured in your Supabase Dashboard
- If you have 2FA enabled on Zoho, use an App Password instead of your regular password
- The `SMTP_FROM_EMAIL` should match your verified sender email

### 3. Get SMTP Credentials from Supabase

If you're not sure what your SMTP credentials are:

1. Go to your **Supabase Dashboard**
2. Navigate to **Settings** → **Auth**
3. Scroll down to **SMTP Settings**
4. Copy the values:
   - **SMTP Host** → `SMTP_HOST`
   - **SMTP Port** → `SMTP_PORT`
   - **SMTP User** → `SMTP_USER`
   - **SMTP Password** → `SMTP_PASSWORD`
   - **Sender Email** → `SMTP_FROM_EMAIL`

### 4. Configure Notification Recipients

The notification emails are currently hardcoded to send to:
- `breider@wellflex.co`
- `breidercastro@icloud.com`

To change these recipients, edit `lib/utils/email.ts` and update the `ADMIN_EMAILS` array.

## How It Works

1. When a user submits a new request (time correction, PTO, etc.), the system:
   - Creates the request in the database
   - Fetches user and team information
   - Sends an email notification to all admin email addresses via SMTP
   - Sends a confirmation email to the requester

2. The emails include:
   - Request type (Time Correction, PTO, Medical Leave, etc.)
   - Submitter's name and email
   - Team name
   - Date range (from/to dates)
   - Time range (if provided)
   - Description

3. Email sending happens asynchronously, so if email fails, the request creation still succeeds.

## Testing

To test email notifications:

1. Make sure all SMTP environment variables are set in Vercel
2. Submit a test request through the application
3. Check the admin email inboxes for the notification
4. Check the requester's email for the confirmation

## Troubleshooting

### Emails not being sent?

1. **Check environment variables**: Make sure all SMTP variables are set correctly in Vercel
2. **Check Vercel logs**: Look for `[EMAIL]` prefixed logs to see what's happening
3. **Verify SMTP credentials**: Test the same credentials in Supabase Dashboard → SMTP Settings
4. **Check Zoho account**: Make sure your Zoho account is active and not rate-limited

### Rate Limits

Zoho Mail SMTP typically allows:
- **Free accounts**: ~25 emails per day
- **Paid accounts**: Higher limits (check your plan)

If you exceed these limits, you'll need to wait or upgrade your Zoho plan.

### Common Errors

- **"Authentication failed"**: Check your SMTP password (use App Password if 2FA is enabled)
- **"Connection timeout"**: Verify SMTP_HOST and SMTP_PORT are correct
- **"Relay access denied"**: Make sure you're using the correct SMTP credentials

## Environment Variables Summary

Required in Vercel:
- `SMTP_HOST` - e.g., `smtp.zoho.com`
- `SMTP_PORT` - e.g., `587` or `465`
- `SMTP_USER` - Your Zoho email address
- `SMTP_PASSWORD` - Your Zoho password or App Password
- `SMTP_FROM_EMAIL` - Sender email (e.g., `Time Tracker <your-email@zoho.com>`)
