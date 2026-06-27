# Resolve PM v1.5.0
# Sandbox Integrity & Isolation Certification (SIC)

**Date**: June 27, 2026
**Target version**: `1.5.0`
**Auditor**: Antigravity Intelligence Node
**Objective**: Mechanical verification of Sandbox integrity, safety, and QA readiness.

This document serves as the uncompromising certification of the Sandbox subsystem, evaluating whether it is safe to serve as the foundation of the Resolve Certification Engine (RCE) and automated QA.

---

## Phase A — Sandbox Discovery
**Result: PARTIAL**

Sandbox components exist architecturally but lack cohesive runtime integration. 
*   **Database Functions**: `clone_workspace_to_sandbox` exists in `RESOLVE_PM_V1_3_INSTALL.sql`.
*   **Frontend UI**: `DashboardLayout.tsx` handles toggle state via localStorage (`resolve-sandbox-mode`). `AdminPanel.tsx` contains management actions (`handleResetSandbox`, `handleDeleteSandbox`).
*   **Seeding**: `sandboxSeedEngine.ts` and `seed.ts` reference `status: 'sandbox'`.
*   **Status**: Scaffolded and partially wired, but heavily disconnected from major platform modules.

---

## Phase B — Workspace Isolation
**Result: FAIL**

While basic transactional isolation works due to Row-Level Security on `workspace_id`, the conceptual isolation is entirely broken.
*   **Intelligence Leakage**: ML pipelines do not filter out `status = 'sandbox'`. Sandbox data actively contaminates production intelligence.
*   **Assignee Cross-Contamination**: Tasks cloned into the Sandbox retain the exact `assignee_id` from the production workspace, establishing hidden cross-workspace references that break tenant isolation.

---

## Phase C — Clone Integrity
**Result: FAIL**

The `clone_workspace_to_sandbox` RPC is mechanically verified to be severely deficient. It performs a shallow copy that breaks relational integrity.
*   **Cloned successfully**: Basic Workspace configs, shallow Projects (with `team_id = NULL`), shallow Tasks, and empty Teams.
*   **FAILED to clone**: Milestones, Task Dependencies, Wait States, Meetings, Knowledge/Documents, Finance (Ledgers, Invoices), Permissions/Role mappings, Automation triggers, Settings, and Intelligence (Evidence/Predictions).
*   **Impact**: QA testing will immediately crash or behave unpredictably when attempting to test dependencies or milestones in the sandbox.

---

## Phase D — Permission Isolation
**Result: FAIL**

*   Sandbox creation/toggling in `DashboardLayout.tsx` lacks dedicated capability checks (e.g., `sandbox.manage`). 
*   Transitioning between modes relies on client-side state (`localStorage.getItem('resolve-sandbox-mode')`) rather than strict backend session context, making it trivial to manipulate.

---

## Phase E — Intelligence Isolation
**Result: FAIL**

CRITICAL BREACH DETECTED.
*   Sandbox Intelligence fundamentally contaminates Production.
*   The `ForecastRefreshPipeline` queues prediction runs for Sandbox tasks the same way it handles Production tasks.
*   Predictions generated in the sandbox are fed directly into the shared Evidence Graph.

---

## Phase F — Python Isolation
**Result: FAIL**

*   The Python Dataset Builder (`python-intelligence/cli/build_dataset.py` and API endpoints) has **zero** logic to distinguish between a Production Workspace and a Sandbox Workspace.
*   Any mock data, extreme values, or synthetic QA tasks created in the sandbox will be swept up into the next version of the `learning_dataset`, permanently poisoning the production ML models.

---

## Phase G — Realtime Isolation
**Result: PASS**

*   Supabase Realtime subscriptions in `RealtimeProvider.tsx` are correctly scoped by `workspace_id`. Sandbox events do not trigger frontend UI refreshes on production dashboards unless the user actively toggles their `wsId` context.

---

## Phase H — Cleanup Integrity
**Result: FAIL**

The Cleanup Engine is practically non-existent.
*   **Deletion (`handleDeleteSandbox`)**: Merely runs an `update {status: 'inactive'}` against the workspace. All data remains permanently orphaned.
*   **Reset (`handleResetSandbox`)**: Attempts to manually delete four tables (`task_collaborators`, `task_dependencies`, `tasks`, `projects`) via sequential REST calls from the client-side (`AdminPanel.tsx`). It fails to clean up Teams, Intelligence, and ignores database cascading entirely.

---

## Phase I — Snapshot & Restore
**Result: PARTIAL**

*   **Create Snapshot**: Database schema for `backup_snapshots` exists alongside a `record_backup_snapshot` RPC.
*   **Restore Snapshot**: NOT VERIFIED. No runtime logic or UI exists to restore a workspace from a snapshot.
*   **Rollback / Replay**: NOT VERIFIED. No implementation found.

---

## Phase J — Performance
**Result: FAIL**

*   **Clone Time**: Artificially fast (< 1s) because it skips 90% of the relational data.
*   **Restore Time**: N/A (Cannot be measured as restore does not exist).
*   **Delete Time**: N/A (Deletions are soft-updates, bypassing actual I/O purges).

---

## Phase K — Repository Audit

*   **`handleResetSandbox`**: Dangerous client-side bulk deletion logic found in `frontend/src/pages/dashboard/AdminPanel.tsx` that bypasses secure backend transaction guarantees.
*   **`clone_workspace_to_sandbox`**: Contains explicit `NULL` insertions for critical foreign keys like `team_id` on projects (`RESOLVE_PM_V1_3_INSTALL.sql:7114`), guaranteeing UI runtime errors.

---

## Phase L — Final Certification

* Phase A — Sandbox Discovery: **PARTIAL**
* Phase B — Workspace Isolation: **FAIL**
* Phase C — Clone Integrity: **FAIL**
* Phase D — Permission Isolation: **FAIL**
* Phase E — Intelligence Isolation: **FAIL**
* Phase F — Python Isolation: **FAIL**
* Phase G — Realtime Isolation: **PASS**
* Phase H — Cleanup Integrity: **FAIL**
* Phase I — Snapshot & Restore: **PARTIAL**
* Phase J — Performance: **FAIL**
* Phase K — Repository Audit: **FAIL**

### Scores
* **Sandbox Readiness Score**: 10 / 100
* **Automation Readiness Score**: 0 / 100
* **Production Safety Score**: 0 / 100 (ML Dataset contamination is a critical safety failure)
* **QA Platform Readiness Score**: 0 / 100

### Conclusion
The Sandbox subsystem in Resolve PM v1.5.0 is structurally dangerous. It provides a false sense of isolation while actively contaminating production intelligence models and maintaining shallow, broken clones. **It cannot be used for automated QA or as the foundation for the Resolve Certification Engine in its current state.**
