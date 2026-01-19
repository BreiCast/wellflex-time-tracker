# Zoho SMTP Setup for Supabase

## Step 1: Get Your Zoho SMTP Credentials

### Option A: Using Your Zoho Account Password

1. **SMTP Host**: `smtp.zoho.com`
   - For EU accounts: `smtp.zoho.eu`
   - For India accounts: `smtp.zoho.in`

2. **SMTP Port**: 
   - `587` (TLS/STARTTLS) - Recommended
   - `465` (SSL) - Alternative

3. **SMTP User**: Your full Zoho email address
   - Example: `yourname@zoho.com`

4. **SMTP Password**: Your Zoho account password

### Option B: Using App Password (Recommended if 2FA is enabled)

If you have Two-Factor Authentication (2FA) enabled on your Zoho account:

1. Go to [Zoho Account Security](https://accounts.zoho.com/home#security)
2. Sign in to your Zoho account
3. Scroll down to **App Passwords** section
4. Click **Generate New Password**
5. Give it a name (e.g., "Supabase SMTP")
6. Copy the generated password (you won't see it again!)
7. Use this App Password instead of your regular password

## Step 2: Configure SMTP in Supabase

1. Go to your **Supabase Dashboard**
2. Navigate to **Settings** → **Auth**
3. Scroll down to **SMTP Settings**
4. Enable **"Enable Custom SMTP"**
5. Fill in the following:

   ```
   SMTP Host: smtp.zoho.com
   SMTP Port: 587
   SMTP User: yourname@zoho.com
   SMTP Password: [Your Zoho password or App Password]
   Sender Email: yourname@zoho.com
   Sender Name: Time Tracker (or your preferred name)
   ```

6. Click **Save**

## Step 3: Test Email Sending

1. After saving, Supabase will test the SMTP connection
2. Check for any error messages
3. If successful, you should see a confirmation message

## Step 4: Verify Email Domain (Optional but Recommended)

If you're using a custom domain with Zoho:

1. Make sure your domain is verified in Zoho
2. SPF and DKIM records should be set up correctly
3. This helps with email deliverability

## Troubleshooting

### "Authentication failed" error
- **Check your password**: Make sure you're using the correct password
- **If 2FA enabled**: Use an App Password instead of your regular password
- **Check email format**: Make sure you're using your full email address as the SMTP User

### "Connection timeout" error
- **Check port**: Try port `465` (SSL) instead of `587` (TLS)
- **Check host**: Verify you're using the correct regional host:
  - `smtp.zoho.com` (US/Global)
  - `smtp.zoho.eu` (Europe)
  - `smtp.zoho.in` (India)
- **Firewall**: Make sure port 587 or 465 is not blocked

### Emails going to spam
- **Verify domain**: Set up SPF and DKIM records for your domain
- **Sender reputation**: Use a verified email address
- **Email content**: Avoid spam trigger words in your email templates

### "Less secure apps" error
- Zoho may require enabling "Less Secure Apps" for some accounts
- Alternatively, use an App Password (recommended)
- Check your Zoho account security settings

## Quick Reference

```
SMTP Host: smtp.zoho.com
SMTP Port: 587 (or 465)
SMTP User: yourname@zoho.com
SMTP Password: [Your password or App Password]
Sender Email: yourname@zoho.com
Sender Name: Time Tracker
```

## Security Best Practices

1. ✅ Use App Passwords instead of your main account password
2. ✅ Enable 2FA on your Zoho account
3. ✅ Regularly rotate your App Passwords
4. ✅ Use a dedicated email address for sending (not your personal one)
5. ✅ Monitor email sending activity in Zoho

## Rate Limits

Zoho Mail SMTP typically allows:
- **Free accounts**: ~25 emails per day
- **Paid accounts**: Higher limits (check your plan)

If you hit rate limits, consider:
- Upgrading your Zoho plan
- Using a different email service (SendGrid, Mailgun, etc.)
- Implementing email queuing

## Next Steps

After configuring Zoho SMTP:

1. ✅ Test email sending in Supabase
2. ✅ Customize email templates in Supabase Dashboard
3. ✅ Test the full signup flow
4. ✅ Check spam folder for test emails
5. ✅ Monitor email delivery rates

