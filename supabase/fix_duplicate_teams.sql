-- Add unique constraint to teams.name to prevent duplicates
-- Run this to add the constraint to existing database

-- First, remove any duplicate teams (keep the oldest one)
WITH ranked_teams AS (
  SELECT 
    id,
    name,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at) as rn
  FROM public.teams
)
DELETE FROM public.teams
WHERE id IN (
  SELECT id FROM ranked_teams WHERE rn > 1
);

-- Add unique constraint
ALTER TABLE public.teams
ADD CONSTRAINT teams_name_unique UNIQUE(name);

-- Verify constraint was added
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'teams' AND constraint_name = 'teams_name_unique';

