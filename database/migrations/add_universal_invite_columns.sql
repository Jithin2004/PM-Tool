-- Universal Invite Engine Migration

-- 1. Add status
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' 
CHECK (status IN ('active', 'invited', 'disabled'));

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS department text;

-- 2. Add token fields
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS invite_token text UNIQUE;

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;

-- 3. Add invite metadata
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS invite_source text 
CHECK (invite_source IN ('onboarding', 'manual', 'bulk_import'));

-- 4. Set existing users to active safely
UPDATE public.users SET status = 'active' WHERE status IS NULL;
