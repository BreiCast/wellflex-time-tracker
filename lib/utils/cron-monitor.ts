import type { SupabaseClient } from '@supabase/supabase-js'

export const CRON_JOBS = {
  notifications: 'notifications_run',
  missedPunch: 'missed_punch_run'
} as const

type CronRunStatus = 'SUCCESS' | 'FAILED'

export async function recordCronRun(
  supabase: SupabaseClient,
  params: {
    jobName: string
    status: CronRunStatus
    startedAt: Date
    details?: Record<string, unknown>
    errorMessage?: string
  }
) {
  const finishedAt = new Date()

  const payload = {
    job_name: params.jobName,
    status: params.status,
    started_at: params.startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - params.startedAt.getTime(),
    details: params.details ?? {},
    error_message: params.errorMessage ?? null
  }

  const { error } = await supabase.from('cron_job_runs' as any).insert(payload as any)

  if (error) {
    console.error('[CRON][MONITOR] Failed to record cron run:', error)
  }

  const logPrefix = `[CRON][${params.jobName}] ${params.status}`
  console.log(
    `${logPrefix} finished_at=${payload.finished_at} duration_ms=${payload.duration_ms} details=${JSON.stringify(payload.details)}`
  )
}
