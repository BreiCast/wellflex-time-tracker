-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE role_type AS ENUM ('MEMBER', 'MANAGER', 'ADMIN');
CREATE TYPE request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE adjustment_type AS ENUM ('ADD_TIME', 'SUBTRACT_TIME', 'OVERRIDE');
CREATE TYPE break_type AS ENUM ('BREAK', 'LUNCH');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teams table
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT teams_name_unique UNIQUE(name)
);

-- Team members table
CREATE TABLE public.team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role role_type NOT NULL DEFAULT 'MEMBER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(team_id, user_id)
);

-- Time sessions table (append-only)
CREATE TABLE public.time_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    clock_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    clock_out_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES public.users(id),
    CONSTRAINT clock_out_after_clock_in CHECK (clock_out_at IS NULL OR clock_out_at >= clock_in_at)
);

-- Break segments table (append-only)
CREATE TABLE public.break_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_session_id UUID NOT NULL REFERENCES public.time_sessions(id) ON DELETE CASCADE,
    break_type break_type NOT NULL DEFAULT 'BREAK',
    break_start_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    break_end_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES public.users(id),
    CONSTRAINT break_end_after_start CHECK (break_end_at IS NULL OR break_end_at >= break_start_at)
);

-- Notes table
CREATE TABLE public.notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time_session_id UUID NOT NULL REFERENCES public.time_sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES public.users(id)
);

-- Requests table
CREATE TABLE public.requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    time_session_id UUID REFERENCES public.time_sessions(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL,
    description TEXT NOT NULL,
    status request_status NOT NULL DEFAULT 'PENDING',
    requested_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES public.users(id),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.users(id),
    review_notes TEXT
);

-- Adjustments table
CREATE TABLE public.adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    time_session_id UUID REFERENCES public.time_sessions(id) ON DELETE CASCADE,
    adjustment_type adjustment_type NOT NULL,
    minutes INTEGER NOT NULL,
    effective_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES public.users(id)
);

-- Schedules table for team work schedules
CREATE TABLE public.schedules (
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

-- Audit logs table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES public.users(id)
);

-- Prevent UPDATE/DELETE on time_sessions (append-only, except clock_out_at and team_id)
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

CREATE TRIGGER prevent_time_sessions_update
    BEFORE UPDATE ON public.time_sessions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_time_sessions_update_delete();

CREATE TRIGGER prevent_time_sessions_delete
    BEFORE DELETE ON public.time_sessions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_time_sessions_update_delete();

-- Prevent UPDATE/DELETE on break_segments (append-only, except break_end_at)
CREATE OR REPLACE FUNCTION prevent_break_segments_update_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow UPDATE only if break_end_at is being set and was previously NULL
    IF TG_OP = 'UPDATE' AND OLD.break_end_at IS NULL AND NEW.break_end_at IS NOT NULL THEN
        -- Only allow changing break_end_at, nothing else
        IF (OLD.id, OLD.time_session_id, OLD.break_type, OLD.break_start_at, OLD.created_at, OLD.created_by) 
           IS DISTINCT FROM 
           (NEW.id, NEW.time_session_id, NEW.break_type, NEW.break_start_at, NEW.created_at, NEW.created_by) THEN
            RAISE EXCEPTION 'break_segments table is append-only. Only break_end_at can be updated.';
        END IF;
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'break_segments table is append-only. Use requests and adjustments for corrections.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_break_segments_update
    BEFORE UPDATE ON public.break_segments
    FOR EACH ROW
    EXECUTE FUNCTION prevent_break_segments_update_delete();

CREATE TRIGGER prevent_break_segments_delete
    BEFORE DELETE ON public.break_segments
    FOR EACH ROW
    EXECUTE FUNCTION prevent_break_segments_update_delete();

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    audit_user_id UUID;
    record_user_id UUID;
BEGIN
    -- Get user_id from record (varies by table)
    -- Tables with user_id: time_sessions, requests, adjustments, team_members
    -- Tables without user_id: break_segments, notes, teams
    IF TG_TABLE_NAME IN ('time_sessions', 'requests', 'adjustments', 'team_members') THEN
        record_user_id := COALESCE(
            (NEW.user_id)::UUID,
            (OLD.user_id)::UUID
        );
    ELSIF TG_TABLE_NAME = 'break_segments' THEN
        -- For break_segments, get user_id from the related time_session
        IF TG_OP = 'DELETE' THEN
            SELECT user_id INTO record_user_id
            FROM public.time_sessions
            WHERE id = OLD.time_session_id;
        ELSE
            SELECT user_id INTO record_user_id
            FROM public.time_sessions
            WHERE id = NEW.time_session_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'notes' THEN
        -- For notes, get user_id from the related time_session
        IF TG_OP = 'DELETE' THEN
            SELECT user_id INTO record_user_id
            FROM public.time_sessions
            WHERE id = OLD.time_session_id;
        ELSE
            SELECT user_id INTO record_user_id
            FROM public.time_sessions
            WHERE id = NEW.time_session_id;
        END IF;
    ELSE
        -- For teams and other tables without user_id, set to NULL
        record_user_id := NULL;
    END IF;
    
    -- Try to get created_by user ID based on table structure
    -- Tables with created_by: time_sessions, break_segments, notes, requests, adjustments
    -- Tables without created_by: teams, team_members
    IF TG_TABLE_NAME IN ('time_sessions', 'break_segments', 'notes', 'requests', 'adjustments') THEN
        audit_user_id := COALESCE(
            auth.uid(),
            (NEW.created_by)::UUID,
            (OLD.created_by)::UUID,
            record_user_id
        );
    ELSE
        -- For tables without created_by, use user_id or auth.uid()
        audit_user_id := COALESCE(
            auth.uid(),
            record_user_id
        );
    END IF;
    
    -- Only create audit log if we have a user ID
    IF audit_user_id IS NOT NULL THEN
        INSERT INTO public.audit_logs (
            user_id,
            action,
            table_name,
            record_id,
            old_data,
            new_data,
            created_by
        ) VALUES (
            record_user_id,
            TG_OP,
            TG_TABLE_NAME,
            COALESCE(NEW.id, OLD.id),
            CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
            CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
            audit_user_id
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for all tables
CREATE TRIGGER audit_time_sessions
    AFTER INSERT OR UPDATE OR DELETE ON public.time_sessions
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_break_segments
    AFTER INSERT OR UPDATE OR DELETE ON public.break_segments
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_notes
    AFTER INSERT OR UPDATE OR DELETE ON public.notes
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_requests
    AFTER INSERT OR UPDATE OR DELETE ON public.requests
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_adjustments
    AFTER INSERT OR UPDATE OR DELETE ON public.adjustments
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_team_members
    AFTER INSERT OR UPDATE OR DELETE ON public.team_members
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_schedules
    AFTER INSERT OR UPDATE OR DELETE ON public.schedules
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.break_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can view team members"
    ON public.users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members tm1
            WHERE tm1.user_id = users.id
            AND public.is_team_member(tm1.team_id, auth.uid())
        )
    );

-- RLS Policies for teams
CREATE POLICY "Users can view teams they belong to"
    ON public.teams FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_id = teams.id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can create teams"
    ON public.teams FOR INSERT
    WITH CHECK (true); -- Will be checked in application logic

CREATE POLICY "Admins can update teams"
    ON public.teams FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_id = teams.id AND user_id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Security definer functions to avoid RLS recursion
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

-- RLS Policies for team_members
-- Using security definer functions to avoid infinite recursion
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

-- RLS Policies for schedules
CREATE POLICY "Users can view own schedules"
    ON public.schedules FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own schedules"
    ON public.schedules FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- RLS Policies for time_sessions
CREATE POLICY "Users can view own time sessions"
    ON public.time_sessions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Managers can view team time sessions"
    ON public.time_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_id = time_sessions.team_id 
            AND user_id = auth.uid() 
            AND role IN ('MANAGER', 'ADMIN')
        )
    );

CREATE POLICY "Users can create own time sessions"
    ON public.time_sessions FOR INSERT
    WITH CHECK (user_id = auth.uid() AND created_by = auth.uid());

-- RLS Policies for break_segments
CREATE POLICY "Users can view own break segments"
    ON public.break_segments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.time_sessions
            WHERE id = break_segments.time_session_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can view team break segments"
    ON public.break_segments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.time_sessions ts
            JOIN public.team_members tm ON ts.team_id = tm.team_id
            WHERE ts.id = break_segments.time_session_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('MANAGER', 'ADMIN')
        )
    );

CREATE POLICY "Users can create own break segments"
    ON public.break_segments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.time_sessions
            WHERE id = break_segments.time_session_id AND user_id = auth.uid()
        )
        AND created_by = auth.uid()
    );

-- RLS Policies for notes
CREATE POLICY "Users can view notes for own sessions"
    ON public.notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.time_sessions
            WHERE id = notes.time_session_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can view team notes"
    ON public.notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.time_sessions ts
            JOIN public.team_members tm ON ts.team_id = tm.team_id
            WHERE ts.id = notes.time_session_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('MANAGER', 'ADMIN')
        )
    );

CREATE POLICY "Users can create notes for own sessions"
    ON public.notes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.time_sessions
            WHERE id = notes.time_session_id AND user_id = auth.uid()
        )
        AND created_by = auth.uid()
    );

-- RLS Policies for requests
CREATE POLICY "Users can view own requests"
    ON public.requests FOR SELECT
    USING (user_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Managers can view team requests"
    ON public.requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_id = requests.team_id 
            AND user_id = auth.uid() 
            AND role IN ('MANAGER', 'ADMIN')
        )
    );

CREATE POLICY "Users can create requests"
    ON public.requests FOR INSERT
    WITH CHECK (user_id = auth.uid() AND created_by = auth.uid());

CREATE POLICY "Managers can update requests"
    ON public.requests FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_id = requests.team_id 
            AND user_id = auth.uid() 
            AND role IN ('MANAGER', 'ADMIN')
        )
    );

-- RLS Policies for adjustments
CREATE POLICY "Users can view own adjustments"
    ON public.adjustments FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Managers can view team adjustments"
    ON public.adjustments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_id = adjustments.team_id 
            AND user_id = auth.uid() 
            AND role IN ('MANAGER', 'ADMIN')
        )
    );

CREATE POLICY "Managers can create adjustments"
    ON public.adjustments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_id = adjustments.team_id 
            AND user_id = auth.uid() 
            AND role IN ('MANAGER', 'ADMIN')
        )
        AND created_by = auth.uid()
    );

-- RLS Policies for audit_logs
CREATE POLICY "Users can view own audit logs"
    ON public.audit_logs FOR SELECT
    USING (user_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Managers can view team audit logs"
    ON public.audit_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members tm
            JOIN public.audit_logs al ON tm.team_id IN (
                SELECT team_id FROM public.time_sessions WHERE user_id = al.user_id
                UNION
                SELECT team_id FROM public.requests WHERE user_id = al.user_id
                UNION
                SELECT team_id FROM public.adjustments WHERE user_id = al.user_id
            )
            WHERE tm.user_id = auth.uid() AND tm.role IN ('MANAGER', 'ADMIN')
        )
    );

-- Create indexes for performance
CREATE INDEX idx_time_sessions_user_id ON public.time_sessions(user_id);
CREATE INDEX idx_time_sessions_team_id ON public.time_sessions(team_id);
CREATE INDEX idx_time_sessions_clock_in_at ON public.time_sessions(clock_in_at);
CREATE INDEX idx_break_segments_time_session_id ON public.break_segments(time_session_id);
CREATE INDEX idx_requests_user_id ON public.requests(user_id);
CREATE INDEX idx_requests_status ON public.requests(status);
CREATE INDEX idx_adjustments_user_id ON public.adjustments(user_id);
CREATE INDEX idx_adjustments_effective_date ON public.adjustments(effective_date);
CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);

