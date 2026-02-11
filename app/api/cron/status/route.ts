import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { verifyCronBearerToken } from '@/lib/utils/cron-auth'
import { CRON_JOBS } from '@/lib/utils/cron-monitor'

export async function GET(request: NextRequest) {
  if (!verifyCronBearerToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceSupabaseClient()

  const { data, error } = await supabase
    .from('cron_job_runs' as any)
    .select('job_name, status, started_at, finished_at, duration_ms, details, error_message')
    .in('job_name', [CRON_JOBS.notifications, CRON_JOBS.missedPunch])
    .order('finished_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const latestByJob = {
    [CRON_JOBS.notifications]: null as any,
    [CRON_JOBS.missedPunch]: null as any
  }

  for (const run of data || []) {
    if (!latestByJob[run.job_name as keyof typeof latestByJob]) {
      latestByJob[run.job_name as keyof typeof latestByJob] = run
    }
  }

  return NextResponse.json({
    success: true,
    checkedAt: new Date().toISOString(),
    jobs: latestByJob
  })
}
