# Resolve PM Database Seeding & Migration Guidelines

To maintain production safety, protect historical data, and prevent pollution of organizational memory, follow these strict seeding and migration guidelines.

## 1. Production Migrations

Production migrations must be strictly structural (DDL only) or focus on necessary seed settings.
* **Schema Only**: Migrations should alter tables, create schemas, add functions/procedures, or define indices.
* **No Mock Data**: Never insert fake users, mock projects, or test tasks in standard migrations.
* **No Direct inserts into auth.users**: Bypassing the official registration flows in production can lead to broken profiles and referential integrity errors.

---

## 2. Simulation & Test Migrations

When writing simulation scripts (e.g., dogfood testing or load-testing scenarios), follow these isolation procedures:

### A. Required Metadata Tagging
All simulation or demo records must be explicitly marked. For workspaces, you MUST populate the `metadata` and `status` fields as follows:

```sql
INSERT INTO workspaces (id, name, status, metadata)
VALUES (
    'your-uuid-here',
    'Resolve Simulation Workspace',
    'sandbox',
    '{"environment": "simulation", "safe_to_purge": true, "created_by": "system"}'::jsonb
);
```

### B. Workspace Sandbox Strategy
* Instead of inserting test records into existing production workspaces, always clone target data into an isolated **Sandbox Workspace** (using `clone_workspace_to_sandbox` RPC).
* The `status` of this workspace must be set to `'sandbox'`.
* This isolates sandbox activity from standard company analytics.

---

## 3. Safe Deletion & Data Lifecycle

* **No Hard Deletes**: Never use `DELETE FROM` statements in public schema tables for active workspaces, users, or projects. Always utilize status flags or timestamps (`deleted_at`).
* PostgreSQL intercepts are in place to automatically translate hard deletes on `workspaces`, `users`, and `projects` into updates:
  * Deleting a `workspace` -> Marks status as `inactive`.
  * Deleting a `user` -> Sets role to `viewer` and clears `workspace_id`.
  * Deleting a `project` -> Sets `deleted_at = NOW()` and status = `archived`.
