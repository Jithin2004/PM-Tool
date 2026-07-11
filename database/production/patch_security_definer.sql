-- Resolve PM Enterprise — Security Definer search_path Hardening Migration
-- Idempotently updates the search_path configuration for all insecure SECURITY DEFINER functions.
-- This does NOT drop, recreate, or alter function signatures, owners, permissions, or logic.

ALTER FUNCTION public.get_workspace_operational_summary(p_workspace_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.record_backup_snapshot(p_workspace_id uuid, p_snapshot_type text, p_status text, p_metadata jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.check_storage_allowed(p_workspace_id uuid, p_file_size bigint, p_mime_type text) SET search_path = public, extensions;
ALTER FUNCTION public.accept_invitation(p_token text) SET search_path = public, extensions;
ALTER FUNCTION public.restore_sandbox_snapshot(p_snapshot_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.clone_workspace_to_sandbox(p_workspace_id uuid, p_user_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.delete_sandbox_workspace(p_workspace_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.create_sandbox_snapshot(p_workspace_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.is_working_day(p_workspace_id uuid, p_date date) SET search_path = public, extensions;
ALTER FUNCTION public.has_capability(p_user_id uuid, p_cap text) SET search_path = public, extensions;
ALTER FUNCTION public.generate_invoice_from_time_logs(p_workspace_id uuid, p_client_id uuid, p_project_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_hourly_rate numeric) SET search_path = public, extensions;
ALTER FUNCTION public.is_active_employee(p_user_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.get_grouped_notifications(p_workspace_id uuid, p_user_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.get_workspace_activity_baseline(p_workspace_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.get_invitation_by_token(p_token text) SET search_path = public, extensions;
ALTER FUNCTION public.notify_on_task_blocked() SET search_path = public, extensions;
ALTER FUNCTION public.get_estimate_history_lookup(p_workspace_id uuid, p_assignee_id uuid, p_project_id uuid, p_current_estimate numeric) SET search_path = public, extensions;
ALTER FUNCTION public.complete_work_session(p_session_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.cleanup_test_workspace(p_workspace_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.get_employee_exit_impact(p_user_id uuid, p_workspace_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.get_delivery_health_trend(p_workspace_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.create_default_calendar_settings() SET search_path = public, extensions;
ALTER FUNCTION public.notify_on_task_assignment() SET search_path = public, extensions;
ALTER FUNCTION public.current_workspace() SET search_path = public, extensions;
ALTER FUNCTION public.get_shared_project_data(p_token text) SET search_path = public, extensions;
ALTER FUNCTION public.submit_client_approval(p_token text, p_approval_id uuid, p_status text, p_notes text) SET search_path = public, extensions;
ALTER FUNCTION public.transfer_workspace_ownership(new_created_by_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.archive_employee(p_user_id uuid, p_status text, p_reason text) SET search_path = public, extensions;
ALTER FUNCTION public.cascade_subtask_status() SET search_path = public, extensions;
ALTER FUNCTION public.get_user_workload_baseline(p_workspace_id uuid, p_user_id uuid, p_role text) SET search_path = public, extensions;
