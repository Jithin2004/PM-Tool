-- Reset the activity_logs hash chain for existing entries.
-- Old entries had hashes computed with a non-deterministic timestamp,
-- making verification impossible. This resets the chain so new entries
-- (with deterministic created_at in the hash) are verifiable.
-- Run in Supabase SQL Editor.

-- Option A: Reset hashes for all existing entries (re-chains them)
-- This recomputes hashes using the stored created_at timestamp.
-- Safe to re-run.
do $$
declare
  rec record;
  prev_hash text := 'GENESIS_BLOCK';
  msg text;
  new_hash text;
begin
  for rec in select * from activity_logs order by created_at asc, id asc
  loop
    msg := coalesce(rec.workspace_id::text, '') ||
           coalesce(rec.actor_id::text, '') ||
           coalesce(rec.project_id::text, '') ||
           coalesce(rec.task_id::text, '') ||
           coalesce(rec.action, '') ||
           coalesce(rec.metadata::text, '{}') ||
           prev_hash ||
           rec.created_at;
    new_hash := encode(sha256(msg::bytea), 'hex');
    update activity_logs set previous_hash = prev_hash, hash = new_hash where id = rec.id;
    prev_hash := new_hash;
  end loop;
end $$;
