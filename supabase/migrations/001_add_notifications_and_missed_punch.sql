-- Migration: Add notification system and missed punch handling
-- This migration adds tables for organization settings, user schedules, notification preferences,
-- notification events, and missed punch flags.

-- Create enum types for notifications
CREATE TYPE notification_type AS ENUM (
  'CLOCK_IN_REMINDER',
  'CLOCK_OUT_REMINDER',
  'BREAK_RETURN_REMINDER',
  'MISSED_PUNCH_REMINDER'
);

CREATE TYPE notification_status AS ENUM (
  'PENDING',
  'SENT',
  'FAILED'
);

-- Organization settings table (global defaults)
CREATE TABLE public.organization_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  missed_punch_threshold_hours INTEGER NOT NULL DEFAULT 12,
  clock_in_reminder_window_minutes INTEGER NOT NULL DEFAULT 30,
  clock_out_reminder_before_minutes INTEGER NOT NULL DEFAULT 15,
  clock_out_reminder_after_minutes INTEGER NOT NULL DEFAULT 30,
  break_return_threshold_minutes INTEGER NOT NULL DEFAULT 30,
  reminder_cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  quiet_hours_start TIME NOT NULL DEFAULT '22:00:00',
  quiet_hours_end TIME NOT NULL DEFAULT '06:00:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = (SELECT id FROM public.organization_settings LIMIT 1))
);

-- Insert default organization settings
INSERT INTO public.organization_settings DEFAULT VALUES;

-- User schedules table (replaces/extends existing schedules table concept)
-- Note: The existing schedules table has user_id, team_id, day_of_week, start_time, end_time
-- We'll add break_expected_minutes to it via ALTER
ALTER TABLE public.schedules
ADD COLUMN IF NOT EXISTS break_expected_minutes INTEGER DEFAULT 0;

-- Notification preferences per user
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  clock_in_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  clock_out_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  break_return_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  missed_punch_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Notification events (records every sent reminder)
CREATE TABLE public.notification_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  status notification_status NOT NULL DEFAULT 'PENDING',
  payload JSONB,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Missed punch flags
CREATE TABLE public.missed_punch_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  time_session_id UUID NOT NULL REFERENCES public.time_sessions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  flag_reason TEXT NOT NULL,
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(time_session_id)
);

-- Create indexes for performance
CREATE INDEX idx_notification_preferences_user_id ON public.notification_preferences(user_id);
CREATE INDEX idx_notification_events_user_id ON public.notification_events(user_id);
CREATE INDEX idx_notification_events_type ON public.notification_events(notification_type);
CREATE INDEX idx_notification_events_created_at ON public.notification_events(created_at);
CREATE INDEX idx_notification_events_user_type_created ON public.notification_events(user_id, notification_type, created_at);
CREATE INDEX idx_missed_punch_flags_user_id ON public.missed_punch_flags(user_id);
CREATE INDEX idx_missed_punch_flags_time_session_id ON public.missed_punch_flags(time_session_id);
CREATE INDEX idx_missed_punch_flags_resolved_at ON public.missed_punch_flags(resolved_at);
CREATE INDEX idx_time_sessions_clock_out_null ON public.time_sessions(clock_out_at) WHERE clock_out_at IS NULL;

-- Enable RLS
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missed_punch_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization_settings
-- Only admins can view and update
CREATE POLICY "Admins can view organization settings"
  ON public.organization_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update organization settings"
  ON public.organization_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- RLS Policies for notification_preferences
-- Users can view and update their own preferences
CREATE POLICY "Users can view own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for notification_events
-- Users can view their own notification events
-- Service role can insert (for cron jobs)
CREATE POLICY "Users can view own notification events"
  ON public.notification_events FOR SELECT
  USING (user_id = auth.uid());

-- Service role bypasses RLS, so no policy needed for inserts
-- But we'll add a policy that allows service role operations
-- (Service role client bypasses RLS by default)

-- RLS Policies for missed_punch_flags
-- Users can view their own flags
-- Managers/admins can view team flags
-- Service role can insert (for cron jobs)
CREATE POLICY "Users can view own missed punch flags"
  ON public.missed_punch_flags FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Managers can view team missed punch flags"
  ON public.missed_punch_flags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = missed_punch_flags.team_id
      AND user_id = auth.uid()
      AND role IN ('MANAGER', 'ADMIN')
    )
  );

-- Add audit triggers for new tables
CREATE TRIGGER audit_organization_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_settings
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_notification_preferences
  AFTER INSERT OR UPDATE OR DELETE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_notification_events
  AFTER INSERT OR UPDATE OR DELETE ON public.notification_events
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_missed_punch_flags
  AFTER INSERT OR UPDATE OR DELETE ON public.missed_punch_flags
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Function to get user's timezone-aware current time
CREATE OR REPLACE FUNCTION get_user_timezone(user_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  user_tz TEXT;
BEGIN
  SELECT COALESCE(timezone, 'UTC') INTO user_tz
  FROM public.notification_preferences
  WHERE user_id = user_uuid;
  
  RETURN COALESCE(user_tz, 'UTC');
END;
$$;
