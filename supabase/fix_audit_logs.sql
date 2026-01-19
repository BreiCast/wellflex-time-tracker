-- Fix audit_logs function to handle tables without created_by field
-- Run this to update the audit log function

CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    audit_user_id UUID;
    record_user_id UUID;
BEGIN
    -- Get user_id from record (varies by table)
    record_user_id := COALESCE(
        (NEW.user_id)::UUID,
        (OLD.user_id)::UUID
    );
    
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

-- Clean up any existing audit logs with NULL created_by (optional)
-- DELETE FROM public.audit_logs WHERE created_by IS NULL;

