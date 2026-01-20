# Email Notifications Setup

This application sends email notifications to administrators whenever a new request is submitted.

## Setup Instructions

### 1. Install Resend Package

```bash
npm install resend
```

### 2. Get Resend API Key

1. Go to [Resend.com](https://resend.com) and sign up for a free account
2. Navigate to **API Keys** in the dashboard
3. Click **Create API Key**
4. Give it a name (e.g., "Time Tracker Notifications")
5. Copy the API key (you'll only see it once!)

### 3. Configure Environment Variables

Add the following environment variables to your `.env.local` file (for local development) and to your Vercel project settings (for production):

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=Time Tracker <noreply@wellflex.co>
```

**Note:** 
- Replace `re_xxxxxxxxxxxxxxxxxxxxx` with your actual Resend API key
- Update `RESEND_FROM_EMAIL` with your verified domain email address in Resend
- You need to verify your domain in Resend before you can send emails from it

### 4. Verify Your Domain in Resend

1. Go to Resend Dashboard → **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `wellflex.co`)
4. Add the DNS records provided by Resend to your domain's DNS settings
5. Wait for verification (usually takes a few minutes)

### 5. Configure Notification Recipients

The notification emails are currently hardcoded to send to:
- `breider@wellflex.co`
- `breidercastro@icloud.com`

To change these recipients, edit `lib/utils/email.ts` and update the `ADMIN_EMAILS` array.

## How It Works

1. When a user submits a new request (time correction, PTO, etc.), the system:
   - Creates the request in the database
   - Fetches user and team information
   - Sends an email notification to all admin email addresses

2. The email includes:
   - Request type (Time Correction, PTO, Medical Leave, etc.)
   - Submitter's name and email
   - Team name
   - Requested date and time range (if provided)
   - Description

3. Email sending happens asynchronously, so if email fails, the request creation still succeeds.

## Testing

To test email notifications:

1. Make sure `RESEND_API_KEY` is set in your environment
2. Submit a test request through the application
3. Check the admin email inboxes for the notification

## Troubleshooting

### Emails not being sent?

1. **Check environment variables**: Make sure `RESEND_API_KEY` is set correctly
2. **Check Resend dashboard**: Look for any errors or rate limit warnings
3. **Check server logs**: Look for email-related error messages in your application logs
4. **Verify domain**: Make sure your sending domain is verified in Resend

### Rate Limits

Resend free tier includes:
- 3,000 emails per month
- 100 emails per day

If you exceed these limits, upgrade to a paid plan or implement email queuing.

## Alternative: Using SMTP Instead of Resend

If you prefer to use SMTP (e.g., with your existing Zoho SMTP setup), you can:

1. Install `nodemailer`: `npm install nodemailer`
2. Update `lib/utils/email.ts` to use nodemailer instead of Resend
3. Add SMTP environment variables:
   ```env
   SMTP_HOST=smtp.zoho.com
   SMTP_PORT=587
   SMTP_USER=your-email@zoho.com
   SMTP_PASSWORD=your-password
   SMTP_FROM_EMAIL=your-email@zoho.com
   ```
