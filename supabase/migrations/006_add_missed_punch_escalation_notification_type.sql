-- Add escalation notification type for long-running active sessions
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'MISSED_PUNCH_ESCALATION';
