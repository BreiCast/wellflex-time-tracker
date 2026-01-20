-- Migration: Add request comments system
-- This migration adds a table for comments on requests, allowing threaded discussions

-- Request comments table (append-only)
CREATE TABLE public.request_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES public.users(id)
);

-- Create indexes for performance
CREATE INDEX idx_request_comments_request_id ON public.request_comments(request_id);
CREATE INDEX idx_request_comments_user_id ON public.request_comments(user_id);
CREATE INDEX idx_request_comments_created_at ON public.request_comments(created_at);

-- Enable RLS
ALTER TABLE public.request_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for request_comments
-- Users can view comments on requests they created or are members of the team
CREATE POLICY "Users can view comments on their requests"
  ON public.request_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.requests
      WHERE requests.id = request_comments.request_id
      AND requests.user_id = auth.uid()
    )
  );

-- Managers/admins can view comments on requests in their teams
CREATE POLICY "Managers can view comments on team requests"
  ON public.request_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.requests
      JOIN public.team_members ON team_members.team_id = requests.team_id
      WHERE requests.id = request_comments.request_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('MANAGER', 'ADMIN')
    )
  );

-- Users can insert comments on requests they created or are members of the team
CREATE POLICY "Users can comment on their requests"
  ON public.request_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requests
      WHERE requests.id = request_comments.request_id
      AND requests.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Managers/admins can comment on requests in their teams
CREATE POLICY "Managers can comment on team requests"
  ON public.request_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requests
      JOIN public.team_members ON team_members.team_id = requests.team_id
      WHERE requests.id = request_comments.request_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('MANAGER', 'ADMIN')
    )
    AND created_by = auth.uid()
  );

-- Add audit trigger
CREATE TRIGGER audit_request_comments
  AFTER INSERT OR UPDATE OR DELETE ON public.request_comments
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();
