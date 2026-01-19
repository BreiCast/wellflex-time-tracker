-- Add break types to break_segments table
-- Types: BREAK (15 min, 2 per day) and LUNCH (1 hour, 1 per day)

-- Create enum type for break types (if it doesn't exist)
DO $$ BEGIN
    CREATE TYPE break_type AS ENUM ('BREAK', 'LUNCH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add break_type column to break_segments (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'break_segments' 
        AND column_name = 'break_type'
    ) THEN
        ALTER TABLE public.break_segments
        ADD COLUMN break_type break_type NOT NULL DEFAULT 'BREAK';
    END IF;
END $$;

