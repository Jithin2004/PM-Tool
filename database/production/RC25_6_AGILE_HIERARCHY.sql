-- RC25_6_AGILE_HIERARCHY.sql
-- Description: Restores Agile Hierarchy layer as an optional execution extension.
-- Adds stories, timeline_baselines and updates epics and tasks idempotently.

-- 1. Update epics table
ALTER TABLE public.epics ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.epics ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL;
ALTER TABLE public.epics ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.epics ADD COLUMN IF NOT EXISTS target_date timestamptz;
ALTER TABLE public.epics ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Migrate existing name -> title if needed (optional)
UPDATE public.epics SET title = name WHERE title IS NULL AND name IS NOT NULL;

-- 2. Create stories table
CREATE TABLE IF NOT EXISTS public.stories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    epic_id uuid REFERENCES public.epics(id) ON DELETE CASCADE,
    milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
    
    title text NOT NULL,
    description text,
    
    story_points numeric,
    acceptance_criteria text,
    
    status text NOT NULL DEFAULT 'backlog',
    priority text NOT NULL DEFAULT 'medium',
    
    assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for stories
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all operations for workspace users" ON public.stories;
CREATE POLICY "Enable all operations for workspace users" 
ON public.stories FOR ALL 
USING (workspace_id = public.current_workspace());

-- 3. Create timeline_baselines table
CREATE TABLE IF NOT EXISTS public.timeline_baselines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    
    name text NOT NULL,
    description text,
    
    baseline_date timestamptz NOT NULL DEFAULT now(),
    planned_start timestamptz,
    planned_end timestamptz,
    actual_start timestamptz,
    actual_end timestamptz,
    
    variance_days numeric,
    confidence_score numeric,
    
    snapshot jsonb,
    prediction_metadata jsonb,
    
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for timeline_baselines
ALTER TABLE public.timeline_baselines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all operations for workspace users" ON public.timeline_baselines;
CREATE POLICY "Enable all operations for workspace users" 
ON public.timeline_baselines FOR ALL 
USING (workspace_id = public.current_workspace());

-- 4. Update tasks table constraints
-- The columns epic_id and story_id already exist, but they lacked foreign keys.
-- We must safely add constraints if they do not exist.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_epic_id_fkey') THEN
        ALTER TABLE public.tasks ADD CONSTRAINT tasks_epic_id_fkey FOREIGN KEY (epic_id) REFERENCES public.epics(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_story_id_fkey') THEN
        ALTER TABLE public.tasks ADD CONSTRAINT tasks_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE SET NULL;
    END IF;
END $$;
