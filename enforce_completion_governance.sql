-- Enforce Task Completion Governance Trigger
-- Prevents a task from being marked as 'done' if there are active wait states or unresolved dependencies.

CREATE OR REPLACE FUNCTION enforce_task_completion_governance()
RETURNS trigger AS $$
DECLARE
  active_wait_state_count INT;
  unresolved_dependency_count INT;
BEGIN
  -- Only run checks if the status is being changed to 'done'
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    
    -- Check for active wait states targeting this task
    SELECT COUNT(*)
    INTO active_wait_state_count
    FROM wait_states
    WHERE target_id = NEW.id
      AND target_type = 'task'
      AND status = 'active';

    IF active_wait_state_count > 0 THEN
      RAISE EXCEPTION 'Governance Violation: Cannot complete task with active wait states.';
    END IF;

    -- Check for unresolved dependencies blocking this task
    SELECT COUNT(*)
    INTO unresolved_dependency_count
    FROM task_dependencies
    WHERE task_id = NEW.id
      AND resolved = false;

    IF unresolved_dependency_count > 0 THEN
      RAISE EXCEPTION 'Governance Violation: Cannot complete task with unresolved dependencies.';
    END IF;
    
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_task_completion ON tasks;

CREATE TRIGGER trigger_enforce_task_completion
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION enforce_task_completion_governance();
