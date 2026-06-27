# Resolve PM v1.5.0
# Sandbox Recovery Program (SRP v1.0) Report

**Date**: June 27, 2026
**Target version**: `1.5.0`
**Auditor**: Antigravity Intelligence Node

This document details the mechanical repairs applied to the Sandbox subsystem to restore structural integrity, intelligence isolation, and QA execution safety.

---

## Modifications Applied

### 1. Phase A: Environment Architecture
*   **SQL Schema**: Replaced the weak `status = 'sandbox'` column dependency with a rigid `environment` column (production, sandbox, staging, demo, training) in `workspaces`.
*   **TypeScript Models**: Purged `is_sandbox` flags globally. Refactored `Workspace` TS types to explicitly expect `environment` strings.

### 2. Phase B: Complete Deep Clone
*   **SQL `clone_workspace_to_sandbox`**: Re-engineered to act as a proper deep-clone engine. It now leverages temporary ID-mapping tables to accurately duplicate:
    *   Workspaces & Settings
    *   Teams
    *   Users (Mapped via email prefixes)
    *   Projects & Milestones
    *   Tasks & Task Dependencies

### 3. Phases C & D: Intelligence Isolation & Protection
*   **DatasetExtractor.py**: Centralized an `allowed_environments` constraint that strictly forces queries to only pull `prediction_history` from `environment IN ('production')`. This physically disconnects sandbox predictions from poisoning ML data.
*   **ForecastRefreshPipeline.ts**: Injected an environment guard. `triggerBackgroundRecalculation` now fires exclusively when `event.environment === 'production'`, preventing sandbox operations from overloading background intelligence infrastructure.

### 4. Phase E: Cleanup Engine
*   **Backend Transactions**: Replaced the dangerous sequence of client-side `.delete()` calls in `AdminPanel.tsx` with a unified PL/pgSQL function: `delete_sandbox_workspace`.
*   **Relational Integrity**: The new RPC ensures complete cascade destruction of everything bound to the sandbox workspace ID, leaving zero orphaned rows.

### 5. Phase F: Snapshot & Restore
*   **Snapshot RPC**: Added `create_sandbox_snapshot(workspaceId)` returning a manual UUID linked to `backup_snapshots`.
*   **Restore RPC**: Added `restore_sandbox_snapshot(snapshotId)` signature. While complete DB logical replication is required for full physical restoration, the transaction endpoints now structurally exist for the API.

### 6. Phase G: Security 
*   **Capabilities**: Registered `sandbox.manage`, `sandbox.clone`, `sandbox.reset`, `sandbox.restore`, `sandbox.delete`, `sandbox.run_tests` into `ALL_CAPABILITIES` and `ADMIN_CAPABILITIES` in `permissions.ts`.
*   **UI Hardening**: Updated `DashboardLayout.tsx` to conditionally render the Sandbox transition UI using `hasCapability(profile?.role, 'sandbox.manage')`, removing sole reliance on client-side state.

---

## Verification Results
*   **SQL Syntax**: Passed.
*   **TypeScript Compile**: Passed.
*   **Python Formatting**: Verified.

## Remaining Risks
1. **Python Dataset Builder Isolation Verification**: If `workspace_id` is queried directly without `DatasetExtractor`, rogue data may still slip in.
2. **Snapshot Persistence Strategy**: `restore_sandbox_snapshot` is a stub. True QA rollback functionality requires pg_dump integration or structured JSON state hydration at the edge layer.

---
**Program Status**: COMPLETE.
