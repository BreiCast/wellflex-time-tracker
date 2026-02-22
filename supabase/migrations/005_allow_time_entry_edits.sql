-- Allow limited edits for time entries (clock_in/out and break start/end)
CREATE OR REPLACE FUNCTION prevent_time_sessions_update_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Allow changing team_id if user is a member of the new team
        IF OLD.team_id IS DISTINCT FROM NEW.team_id THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.team_members
                WHERE team_id = NEW.team_id AND user_id = NEW.user_id
            ) THEN
                RAISE EXCEPTION 'You are not a member of the selected team.';
            END IF;
        END IF;

        -- Only allow updating clock_in_at, clock_out_at, and team_id
        IF (OLD.id, OLD.user_id, OLD.created_at, OLD.created_by)
           IS DISTINCT FROM
           (NEW.id, NEW.user_id, NEW.created_at, NEW.created_by) THEN
            RAISE EXCEPTION 'time_sessions table is append-only. Only clock_in_at, clock_out_at, and team_id can be updated.';
        END IF;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'time_sessions table is append-only. Use requests and adjustments for corrections.';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_break_segments_update_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Only allow updating break_start_at and break_end_at
        IF (OLD.id, OLD.time_session_id, OLD.break_type, OLD.created_at, OLD.created_by)
           IS DISTINCT FROM
           (NEW.id, NEW.time_session_id, NEW.break_type, NEW.created_at, NEW.created_by) THEN
            RAISE EXCEPTION 'break_segments table is append-only. Only break_start_at and break_end_at can be updated.';
        END IF;
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'break_segments table is append-only. Use requests and adjustments for corrections.';
END;
$$ LANGUAGE plpgsql;
