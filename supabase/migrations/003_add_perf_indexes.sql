-- Migration: Add performance indexes to reduce Disk IO
-- This migration adds composite indexes, partial indexes, and covering indexes
-- to optimize the most common query patterns

-- ============================================
-- TIME_SESSIONS TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for active sessions lookup (most common query)
-- Used by: dashboard, tracking page, active session checks
CREATE INDEX IF NOT EXISTS idx_time_sessions_user_active 
  ON public.time_sessions(user_id, clock_out_at) 
  WHERE clock_out_at IS NULL;

-- Composite index for timesheet queries (user + date range + team)
-- Used by: /api/timesheet endpoint
CREATE INDEX IF NOT EXISTS idx_time_sessions_user_team_date 
  ON public.time_sessions(user_id, team_id, clock_in_at DESC);

-- Composite index for date range queries (most common pattern)
-- Used by: timesheet calculations, reporting
CREATE INDEX IF NOT EXISTS idx_time_sessions_date_range 
  ON public.time_sessions(clock_in_at DESC, user_id, team_id);

-- Partial index for running sessions (cron job optimization)
-- Used by: missed-punch cron, active session scans
CREATE INDEX IF NOT EXISTS idx_time_sessions_running 
  ON public.time_sessions(clock_in_at, user_id, team_id) 
  WHERE clock_out_at IS NULL;

-- ============================================
-- BREAK_SEGMENTS TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for active breaks lookup
-- Used by: dashboard, tracking page
CREATE INDEX IF NOT EXISTS idx_break_segments_active 
  ON public.break_segments(time_session_id, break_end_at) 
  WHERE break_end_at IS NULL;

-- Composite index for timesheet break calculations
-- Used by: /api/timesheet endpoint
CREATE INDEX IF NOT EXISTS idx_break_segments_session_date 
  ON public.break_segments(time_session_id, break_start_at);

-- ============================================
-- REQUESTS TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for admin requests view (team + status + date)
-- Used by: /api/admin/requests endpoint
CREATE INDEX IF NOT EXISTS idx_requests_team_status_date 
  ON public.requests(team_id, status, created_at DESC) 
  WHERE status = 'PENDING' OR status IS NULL;

-- Composite index for user requests
-- Used by: user request views
CREATE INDEX IF NOT EXISTS idx_requests_user_date 
  ON public.requests(user_id, created_at DESC);

-- ============================================
-- ADJUSTMENTS TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for timesheet adjustments (user + date + team)
-- Used by: /api/timesheet endpoint
CREATE INDEX IF NOT EXISTS idx_adjustments_user_team_date 
  ON public.adjustments(user_id, team_id, effective_date DESC);

-- ============================================
-- MISSED_PUNCH_FLAGS TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for unresolved flags (most common query)
-- Used by: user views, admin dashboard
CREATE INDEX IF NOT EXISTS idx_missed_punch_flags_unresolved 
  ON public.missed_punch_flags(user_id, resolved_at) 
  WHERE resolved_at IS NULL;

-- Composite index for time_session lookups
-- Used by: cron job duplicate checks
CREATE INDEX IF NOT EXISTS idx_missed_punch_flags_session 
  ON public.missed_punch_flags(time_session_id, resolved_at);

-- ============================================
-- NOTIFICATION_EVENTS TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for user notification history
-- Used by: /api/notifications/me endpoint
CREATE INDEX IF NOT EXISTS idx_notification_events_user_date 
  ON public.notification_events(user_id, created_at DESC);

-- Composite index for cooldown checks (cron optimization)
-- Used by: /api/notifications/run cron job
CREATE INDEX IF NOT EXISTS idx_notification_events_cooldown 
  ON public.notification_events(user_id, notification_type, created_at DESC);

-- ============================================
-- SCHEDULES TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for user schedule lookups
-- Used by: cron jobs, schedule management
CREATE INDEX IF NOT EXISTS idx_schedules_user_active 
  ON public.schedules(user_id, day_of_week, is_active) 
  WHERE is_active = true;

-- ============================================
-- TEAM_MEMBERS TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for role-based queries
-- Used by: admin views, permission checks
CREATE INDEX IF NOT EXISTS idx_team_members_role 
  ON public.team_members(team_id, role, user_id);

-- ============================================
-- REQUEST_COMMENTS TABLE OPTIMIZATIONS
-- ============================================

-- Composite index for request comments
-- Used by: request detail views
CREATE INDEX IF NOT EXISTS idx_request_comments_request_date 
  ON public.request_comments(request_id, created_at ASC);

-- ============================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================

-- Update statistics for query planner
ANALYZE public.time_sessions;
ANALYZE public.break_segments;
ANALYZE public.requests;
ANALYZE public.adjustments;
ANALYZE public.missed_punch_flags;
ANALYZE public.notification_events;
ANALYZE public.schedules;
ANALYZE public.team_members;
ANALYZE public.request_comments;
