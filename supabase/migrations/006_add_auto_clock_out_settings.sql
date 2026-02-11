-- Migration: add organization settings for automatic clock out on max shift
ALTER TABLE public.organization_settings
ADD COLUMN IF NOT EXISTS max_shift_hours INTEGER NOT NULL DEFAULT 16,
ADD COLUMN IF NOT EXISTS auto_clock_out_grace_minutes INTEGER;

ALTER TABLE public.organization_settings
ADD CONSTRAINT organization_settings_max_shift_hours_check
CHECK (max_shift_hours >= 1 AND max_shift_hours <= 24);

ALTER TABLE public.organization_settings
ADD CONSTRAINT organization_settings_auto_clock_out_grace_minutes_check
CHECK (
  auto_clock_out_grace_minutes IS NULL
  OR (auto_clock_out_grace_minutes >= 0 AND auto_clock_out_grace_minutes <= 240)
);
