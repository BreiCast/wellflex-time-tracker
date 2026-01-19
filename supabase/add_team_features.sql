-- Add color and schedule features to teams

-- Add color column to teams table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'teams' 
        AND column_name = 'color'
    ) THEN
        ALTER TABLE public.teams
        ADD COLUMN color TEXT DEFAULT '#6366f1';
    END IF;
END $$;

-- Create schedules table for team work schedules (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT end_after_start CHECK (end_time > start_time),
    UNIQUE(user_id, team_id, day_of_week)
);

-- Add constraints if they don't exist
DO $$ 
BEGIN
    -- Add end_after_start constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'end_after_start' 
        AND conrelid = 'public.schedules'::regclass
    ) THEN
        ALTER TABLE public.schedules
        ADD CONSTRAINT end_after_start CHECK (end_time > start_time);
    END IF;
    
    -- Add unique constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'schedules_user_id_team_id_day_of_week_key'
    ) THEN
        ALTER TABLE public.schedules
        ADD CONSTRAINT schedules_user_id_team_id_day_of_week_key UNIQUE(user_id, team_id, day_of_week);
    END IF;
END $$;

-- Enable RLS on schedules
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Users can view own schedules" ON public.schedules;
DROP POLICY IF EXISTS "Users can manage own schedules" ON public.schedules;

-- RLS Policies for schedules
CREATE POLICY "Users can view own schedules"
    ON public.schedules FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own schedules"
    ON public.schedules FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Allow updating team_id on active time_sessions (for team switching)
-- Update the prevent_time_sessions_update_delete function
CREATE OR REPLACE FUNCTION prevent_time_sessions_update_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow UPDATE only if clock_out_at is being set and was previously NULL
    IF TG_OP = 'UPDATE' AND OLD.clock_out_at IS NULL AND NEW.clock_out_at IS NOT NULL THEN
        -- Only allow changing clock_out_at, nothing else
        IF (OLD.id, OLD.user_id, OLD.team_id, OLD.clock_in_at, OLD.created_at, OLD.created_by) 
           IS DISTINCT FROM 
           (NEW.id, NEW.user_id, NEW.team_id, NEW.clock_in_at, NEW.created_at, NEW.created_by) THEN
            RAISE EXCEPTION 'time_sessions table is append-only. Only clock_out_at can be updated.';
        END IF;
        RETURN NEW;
    END IF;
    
    -- Allow updating team_id if session is still active (for team switching)
    IF TG_OP = 'UPDATE' AND OLD.clock_out_at IS NULL AND NEW.clock_out_at IS NULL THEN
        -- Allow changing team_id, but verify user is member of new team
        IF OLD.team_id IS DISTINCT FROM NEW.team_id THEN
            -- Verify user is member of new team
            IF NOT EXISTS (
                SELECT 1 FROM public.team_members
                WHERE team_id = NEW.team_id AND user_id = NEW.user_id
            ) THEN
                RAISE EXCEPTION 'You are not a member of the selected team.';
            END IF;
            RETURN NEW;
        END IF;
        -- For other updates on active sessions, only allow clock_out_at
        IF (OLD.id, OLD.user_id, OLD.clock_in_at, OLD.created_at, OLD.created_by) 
           IS DISTINCT FROM 
           (NEW.id, NEW.user_id, NEW.clock_in_at, NEW.created_at, NEW.created_by) THEN
            RAISE EXCEPTION 'time_sessions table is append-only. Only team_id and clock_out_at can be updated.';
        END IF;
        RETURN NEW;
    END IF;
    
    RAISE EXCEPTION 'time_sessions table is append-only. Use requests and adjustments for corrections.';
END;
$$ LANGUAGE plpgsql;

