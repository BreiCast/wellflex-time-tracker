-- Add the notification_type enum values used by the notifications runner for
-- open break/lunch reminders. Migration 001 only defined four values, so the
-- app's inserts of LUNCH_NOT_ENDED_REMINDER / BREAK_NOT_ENDED_REMINDER
-- previously failed the enum constraint and were silently swallowed.
--
-- Note: ALTER TYPE ... ADD VALUE must run outside an explicit transaction block
-- that later uses the new value; these standalone statements are safe to run
-- as a single script.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'LUNCH_NOT_ENDED_REMINDER';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'BREAK_NOT_ENDED_REMINDER';
