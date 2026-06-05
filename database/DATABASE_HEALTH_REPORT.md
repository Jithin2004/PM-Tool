# Resolve PM — Database Health Report
*Generated: Sprint 6 Release Candidate Hardening*

## 1. Table Analysis & Consolidation
This section highlights tables that are redundant, unused, or misaligned with the final domain architecture.

| Table Name | Status | Reason |
| :--- | :--- | :--- |
| `profiles` | **SAFE REMOVE** | Fully deprecated in Sprint 1 in favor of the `users` table. Retained only for legacy aliases. |
| `workspace_members` | **SAFE REMOVE** | Replaced entirely by `users` table and Sprint 4 `external_access` scope. |
| `task_comments` | **SAFE REMOVE** | Duplicated by the unified `comments` table. |
| `project_signoffs` | **SAFE REMOVE** | Handled natively by the `universal_approvals` table introduced in Sprint 2. |
| `attendance` | **KEEP** | Essential for HR module operations. |
| `salaries` | **KEEP** | Essential for Finance module operations. |
| `team_events` | **NEEDS REVIEW** | Largely unused by the core application, could be handled by `activity_logs`. |
| `system_audit_ledger` | **SAFE REMOVE** | Duplicated by `activity_logs` which we configured as the central immutable log in Sprint 5. |
| `workspace_settings` | **SAFE REMOVE** | Data is now stored as a JSONB blob on `workspaces.settings` to prevent unnecessary joins. |

## 2. Column Deduplication
Review of individual columns that overlap in purpose.

- `users.designation` vs `users.department`: **KEEP BOTH** (Separate organizational concepts).
- `tasks.is_completed` vs `tasks.status`: **SAFE REMOVE** `is_completed`. Status should dictate state (e.g., 'completed', 'verified').
- `projects.completion_percentage` vs derived calculation: **NEEDS REVIEW**. Stored percentages can drift from actual task completion ratios.

## 3. Orphan Foreign Keys & Missing Cascades
During analysis of the migration scripts, the following referential integrity risks were identified:

- `activity_logs.user_id` -> `users.id`: Missing `ON DELETE SET NULL` or `CASCADE`. Currently restricts user deletion. **Action Required: Update FK.**
- `invoices.project_id` -> `projects.id`: Should be `ON DELETE SET NULL` to retain financial records even if a project is archived/deleted.
- `comments.task_id` -> `tasks.id`: Missing `ON DELETE CASCADE`.

## 4. Missing Indexes
The following columns are frequently queried but lack dedicated indexes, potentially impacting performance as datasets grow:

- `users(workspace_id)`
- `projects(workspace_id, status)`
- `tasks(project_id, assignee_id)`
- `activity_logs(workspace_id, created_at)`
- `universal_approvals(entity_type, entity_id)`

---
*Note: This report is for manual action and review. No automated drops have been executed to preserve data safety.*
