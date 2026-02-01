-- Add min_working_count column to teams table for coverage guardrails
-- NULL means no minimum required (no guardrails for that team)
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS min_working_count INTEGER DEFAULT NULL;

-- Add check constraint to ensure non-negative value when set
ALTER TABLE public.teams
ADD CONSTRAINT min_working_count_non_negative CHECK (min_working_count IS NULL OR min_working_count >= 0);
