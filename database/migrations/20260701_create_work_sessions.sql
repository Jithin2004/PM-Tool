-- Create work_sessions table for operational work tracking

CREATE TABLE IF NOT EXISTS work_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    attendance_session_id UUID REFERENCES clock_events(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
    epic_id UUID REFERENCES epics(id) ON DELETE SET NULL,
    story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    quick_work_item_id UUID, -- For ad-hoc items not yet formalized
    session_type VARCHAR(50) NOT NULL DEFAULT 'general', -- e.g., Task, Story, Epic, Meeting, Research, Documentation
    title VARCHAR(255),
    description TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    switch_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_work_sessions_workspace_user ON work_sessions(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_started_at ON work_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_work_sessions_project ON work_sessions(project_id);

-- RLS setup
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;

-- Allow users to see work sessions in their workspace
CREATE POLICY "Users can view workspace work sessions"
ON work_sessions
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

-- Allow users to create work sessions for themselves
CREATE POLICY "Users can create their own work sessions"
ON work_sessions
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

-- Allow users to update their own work sessions
CREATE POLICY "Users can update their own work sessions"
ON work_sessions
FOR UPDATE
USING (
  user_id = auth.uid() AND
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_work_sessions_updated_at ON work_sessions;
CREATE TRIGGER trigger_work_sessions_updated_at
BEFORE UPDATE ON work_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
