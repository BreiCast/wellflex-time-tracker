-- Cron job run tracking for operational health checks
CREATE TABLE IF NOT EXISTS public.cron_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  details JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_job_runs_job_finished
  ON public.cron_job_runs(job_name, finished_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_job_runs_status_finished
  ON public.cron_job_runs(status, finished_at DESC);

ALTER TABLE public.cron_job_runs ENABLE ROW LEVEL SECURITY;

-- Service role writes records. Allow managers/admins to read status.
CREATE POLICY "Managers can view cron job runs"
  ON public.cron_job_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE user_id = auth.uid()
      AND role IN ('MANAGER', 'ADMIN')
    )
  );

CREATE TRIGGER audit_cron_job_runs
  AFTER INSERT OR UPDATE OR DELETE ON public.cron_job_runs
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();
