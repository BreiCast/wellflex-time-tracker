-- Fix infinite recursion in team_members RLS policies
-- The issue is that the policy checks team_members by querying team_members itself

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view team members of their teams" ON public.team_members;
DROP POLICY IF EXISTS "Admins can manage team members" ON public.team_members;

-- Create a security definer function to check team membership
-- This avoids recursion by using SECURITY DEFINER which bypasses RLS
CREATE OR REPLACE FUNCTION public.is_team_member(team_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_id = team_uuid AND user_id = user_uuid
    );
END;
$$;

-- Create a security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_team_admin(team_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_id = team_uuid 
        AND user_id = user_uuid 
        AND role = 'ADMIN'
    );
END;
$$;

-- Recreate the policies using the security definer functions
-- This avoids recursion because the functions bypass RLS
CREATE POLICY "Users can view team members of their teams"
    ON public.team_members FOR SELECT
    USING (
        public.is_team_member(team_id, auth.uid())
    );

CREATE POLICY "Admins can manage team members"
    ON public.team_members FOR ALL
    USING (
        public.is_team_admin(team_id, auth.uid())
    )
    WITH CHECK (
        public.is_team_admin(team_id, auth.uid())
    );

-- Also fix the users policy that might have similar issues
DROP POLICY IF EXISTS "Users can view team members" ON public.users;

CREATE POLICY "Users can view team members"
    ON public.users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members tm1
            WHERE tm1.user_id = users.id
            AND public.is_team_member(tm1.team_id, auth.uid())
        )
    );

