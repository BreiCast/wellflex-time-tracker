-- Allow updating break_end_at even when it already has a value
-- This enables break duration adjustments to directly modify the break time
-- instead of creating separate adjustments

CREATE OR REPLACE FUNCTION prevent_break_segments_update_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow UPDATE if only break_end_at is being changed
    IF TG_OP = 'UPDATE' THEN
        -- Check if only break_end_at is being modified
        IF (OLD.id, OLD.time_session_id, OLD.break_type, OLD.break_start_at, OLD.created_at, OLD.created_by) 
           IS DISTINCT FROM 
           (NEW.id, NEW.time_session_id, NEW.break_type, NEW.break_start_at, NEW.created_at, NEW.created_by) THEN
            RAISE EXCEPTION 'break_segments table is append-only. Only break_end_at can be updated.';
        END IF
        -- Allow updating break_end_at (whether it was NULL or had a value)
        IF OLD.break_end_at IS DISTINCT FROM NEW.break_end_at THEN
            RETURN NEW;
        END IF
        -- If nothing changed, allow it (no-op update)
        RETURN NEW;
    END IF
    RAISE EXCEPTION 'break_segments table is append-only. Use requests and adjustments for corrections.';
END;
$$ LANGUAGE plpgsql;
