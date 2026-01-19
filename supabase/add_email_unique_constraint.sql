-- Add unique constraint on email in public.users table
-- This provides an additional layer of protection against duplicate emails
-- Note: Supabase Auth already enforces unique emails in auth.users,
-- but this ensures consistency in our public.users table

-- Check if constraint already exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_email_unique' 
        AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT users_email_unique UNIQUE(email);
    END IF;
END $$;

