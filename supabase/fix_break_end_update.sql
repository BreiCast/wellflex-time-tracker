-- Fix break_segments update trigger to allow updating break_end_at
-- Similar to how clock_out_at can be updated for time_sessions

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

