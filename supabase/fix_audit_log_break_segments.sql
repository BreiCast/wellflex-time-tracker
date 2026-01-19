-- Fix audit log function to handle break_segments table correctly
-- break_segments doesn't have user_id, so we need to get it from time_sessions

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

