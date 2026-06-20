const fs = require('fs');
const path = require('path');

const installFile = path.join(__dirname, 'src', '..', '..', 'database', 'production', 'RESOLVE_PM_V1_3_INSTALL.sql');

const phase5dSQL = `

-- =====================================================================================
-- PHASE 5D: AUTOMATION & RULES ENGINE SCHEMA ADDITIONS
-- =====================================================================================

-- 1. Extend automation_rules table Additively
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS conditions jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS actions jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT true;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Optimization Indexes for Rules
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger_enabled ON public.automation_rules(workspace_id, trigger_type, enabled);

-- 2. Create automation_runs table
CREATE TABLE IF NOT EXISTS public.automation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    trigger_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'success', -- 'success', 'failed', 'skipped'
    execution_result jsonb,
    executed_at timestamptz DEFAULT now(),
    automation_context_id text,
    execution_depth integer DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_workspace ON public.automation_runs(workspace_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_rule ON public.automation_runs(rule_id, executed_at DESC);

-- 3. Row Level Security for automation_runs
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

-- automation_runs: view
DROP POLICY IF EXISTS "Automation runs visibility" ON public.automation_runs;
CREATE POLICY "Automation runs visibility" ON public.automation_runs FOR SELECT USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
);

-- automation_runs: insert (system level, but allowing authenticated users to log)
DROP POLICY IF EXISTS "Automation runs insert" ON public.automation_runs;
CREATE POLICY "Automation runs insert" ON public.automation_runs FOR INSERT WITH CHECK (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
);
`;

try {
  let content = fs.readFileSync(installFile, 'utf8');
  if (!content.includes('PHASE 5D: AUTOMATION & RULES ENGINE SCHEMA ADDITIONS')) {
    fs.appendFileSync(installFile, phase5dSQL);
    console.log('Phase 5D SQL successfully appended to RESOLVE_PM_V1_3_INSTALL.sql');
  } else {
    console.log('Phase 5D SQL already exists in RESOLVE_PM_V1_3_INSTALL.sql');
  }
} catch (err) {
  console.error('Error appending Phase 5D SQL:', err);
}
