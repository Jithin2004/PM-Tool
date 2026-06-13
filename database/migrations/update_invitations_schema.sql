-- Update existing invitations table to support the new custom invitation workflow

ALTER TABLE invitations 
  RENAME COLUMN invited_by TO created_by;

ALTER TABLE invitations 
  ADD COLUMN token text UNIQUE;

-- Generate tokens for existing pending invitations
UPDATE invitations 
  SET token = gen_random_uuid()::text 
  WHERE token IS NULL;

ALTER TABLE invitations 
  ALTER COLUMN token SET NOT NULL;

ALTER TABLE invitations 
  ADD COLUMN accepted_at timestamptz;

-- IMPORTANT: After running this script in your Supabase SQL Editor, 
-- please refresh your PostgREST schema cache:
-- 1. Go to Supabase Dashboard -> Database -> API Settings
-- 2. Click "Reload" or "Clear cache" under the Data API section.
-- (Or simply run `NOTIFY pgrst, 'reload schema';` in the SQL Editor)
NOTIFY pgrst, 'reload schema';
