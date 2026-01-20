# Reminder Notifications & Missed Punch Handling - Setup Guide

This document provides setup instructions for the reminder notifications and missed punch handling features.

## Database Setup

### 1. Run SQL Migration

Apply the migration file to your Supabase database:

```bash
# In Supabase SQL Editor, run:
supabase/migrations/001_add_notifications_and_missed_punch.sql
```

This migration creates:
- `organization_settings` - Global defaults for thresholds and reminder timing
- `notification_preferences` - Per-user notification settings
- `notification_events` - Records of all sent reminders
- `missed_punch_flags` - Flags for sessions that need attention
- Updates `schedules` table to include `break_expected_minutes`

### 2. Verify RLS Policies

The migration includes Row Level Security policies. Ensure they're active:
- Members can view their own data
- Admins/Managers can view team data
- Service role can create notification events and missed punch flags

## Environment Variables

### Required for Vercel

Add these to your Vercel project settings:

```env
# SMTP Configuration (Zoho)
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_USER=your-email@wellflex.co
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@wellflex.co
SMTP_FROM_NAME=wetrack

# Cron Job Security
CRON_SECRET=your-random-secret-string-here

# App URL (for email links)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Local Development

Create a `.env.local` file with the same variables:

```env
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_USER=your-email@wellflex.co
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@wellflex.co
SMTP_FROM_NAME=wetrack
CRON_SECRET=local-dev-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Vercel Cron Configuration

The `vercel.json` file includes cron job definitions:

- **Notifications**: Runs every 10 minutes (`*/10 * * * *`)
- **Missed Punch Detection**: Runs every 30 minutes (`*/30 * * * *`)

Vercel will automatically call these endpoints with the `Authorization: Bearer <CRON_SECRET>` header.

## Testing Reminders

### Dry Run Mode

Test the notification system without sending emails:

```bash
# Test notifications (dry run)
curl -X POST "https://your-app.vercel.app/api/notifications/run?dry_run=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test missed punch detection
curl -X POST "https://your-app.vercel.app/api/missed-punch/run" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Local Testing

For local testing, you can manually trigger the endpoints:

```bash
# Start your dev server
npm run dev

# In another terminal, test notifications
curl -X POST "http://localhost:3000/api/notifications/run?dry_run=true" \
  -H "x-cron-secret: local-dev-secret"
```

## Features

### 1. Reminder Types

- **CLOCK_IN_REMINDER**: Sent when user hasn't clocked in within the reminder window after scheduled start
- **CLOCK_OUT_REMINDER**: Sent before scheduled end time and after if still running
- **BREAK_RETURN_REMINDER**: Sent when break exceeds the threshold duration
- **MISSED_PUNCH_REMINDER**: Sent when session exceeds the missed punch threshold

### 2. Missed Punch Detection

Sessions are flagged when:
- Running longer than the threshold (default 12 hours)
- Past scheduled end time (if schedule exists)

### 3. Notification Preferences

Users can configure:
- Enable/disable each reminder type
- Quiet hours (no reminders during these times)
- Timezone (for time-aware reminders)

### 4. Admin Settings

Admins can configure:
- Missed punch threshold (hours)
- Reminder timing windows (minutes)
- Break return threshold (minutes)
- Reminder cooldown (minutes)
- Default quiet hours

## User Interface

### Member Features

1. **Dashboard** (`/tracking`): Shows missed punch warnings for active sessions
2. **Timesheet** (`/dashboard?tab=timesheet`): Displays flagged sessions with "Request Correction" button
3. **Notifications** (`/notifications`): View last 30 notification events

### Admin Features

1. **Settings** (`/admin/settings`): Configure organization-wide thresholds and timing
2. **Schedules** (`/admin/schedules`): Set weekday hours and break expectations for users
3. **Dashboard** (`/admin`): View live status including missed punches

## Workflow

1. **Missed Punch Detected**: Cron job flags sessions exceeding thresholds
2. **Reminder Sent**: User receives email notification (if enabled)
3. **User Action**: User can either:
   - Clock out normally (if session is still active)
   - Submit a TIME_CORRECTION request from the flagged session/day
4. **Admin Review**: Admin reviews and approves request
5. **Adjustment Created**: Approved request creates an Adjustment record
6. **Flag Resolved**: Flag is marked as resolved (manual or automatic)

## Troubleshooting

### Emails Not Sending

1. Verify SMTP credentials in environment variables
2. Check Zoho SMTP settings (app password required)
3. Review notification_events table for error messages
4. Check server logs for `[EMAIL-REMINDERS]` entries

### Cron Jobs Not Running

1. Verify `CRON_SECRET` is set in Vercel
2. Check Vercel cron job logs in dashboard
3. Ensure endpoints return 200 status (not 401)
4. Verify `vercel.json` has correct cron configuration

### Reminders Not Triggering

1. Check user has notification preferences enabled
2. Verify user is not in quiet hours
3. Check cooldown period hasn't expired
4. Ensure user has an active session (for relevant reminders)
5. Verify schedules are set (for clock in/out reminders)

## Database Queries

### Check Notification Events

```sql
SELECT * FROM notification_events 
WHERE user_id = 'user-uuid' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Missed Punch Flags

```sql
SELECT mpf.*, ts.clock_in_at, ts.clock_out_at, u.email
FROM missed_punch_flags mpf
JOIN time_sessions ts ON ts.id = mpf.time_session_id
JOIN users u ON u.id = mpf.user_id
WHERE mpf.resolved_at IS NULL
ORDER BY mpf.flagged_at DESC;
```

### Check Organization Settings

```sql
SELECT * FROM organization_settings;
```

## Support

For issues or questions:
1. Check server logs for error messages
2. Review notification_events table for delivery status
3. Verify all environment variables are set correctly
4. Test with dry_run mode first
