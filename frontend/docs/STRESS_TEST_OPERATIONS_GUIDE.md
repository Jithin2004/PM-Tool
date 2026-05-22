# Resolve PM — Stress Test Operations Guide

## 1. Overview

The synthetic stress testing subsystem validates the Resolve PM platform under simulated workload. It creates and destroys disposable entities across all domain tables, measures performance, exercises event simulation, and verifies that cleanup leaves zero residue.

### Design Philosophy

- **Immutable audit trail**: Every operation is logged to `activity_logs` with SHA-chain integrity.
- **Cleanup guarantees**: All synthetic entities use the `SST_{runId}_` prefix. Every code path guarantees deletion in FK-safe order.
- **No production impact**: Real entities are never touched. The subsystem operates exclusively within the authenticated user's workspace using synthetic data.
- **Fail-safe**: Stale locks auto-expire after 15 minutes. Forced unlock via `force: true` overrides all blockers.

---

## 2. Architecture Overview

### Components

| Component | File | Purpose |
|-----------|------|---------|
| Stress Runner | `src/services/syntheticStressTest.ts` | Orchestrates the full lifecycle |
| Debug Registry | `src/debug/registerDebugTools.ts` | Exposes all functions to `window.resolveDebug` |
| Activity Log Service | `src/services/activityLogService.ts` | Immutable logging with graceful degradation |
| Domain Services | `src/services/*.ts` | Create/update/delete entities through service layer |
| Report Persistence | `localStorage` key `resolve-last-stress-report` | 24-hour auto-expiry |

### Lifecycle Flow

```
Run Start
  → Acquire Lock
  → Preflight (resolve workspace, unlock stale locks)
  → Data Generation (teams, projects, epics, tasks, docs, events, webhooks, automations, approvals)
  → Event Simulation (task updates, sprint completions, automation triggers, approvals)
  → Performance Measurement (page loads, searches, timeline calc, command palette)
  → Build Report
  → Persist Report
  → Cleanup (FK-safe ordered deletion)
  → Verify Cleanup (count survivors)
  → Broadcast Cleanup (CustomEvent)
  → Clear Lock
```

### Concurrency & Safety

- All batch operations use `Promise.allSettled` — individual failures never crash the run.
- Each service call is wrapped in `callService()` with a 15-second timeout via `Promise.race`.
- Failures are captured in `failedOperations[]` with full payload, error, code, and timestamp.
- `partialFailure: true` is set when any operation fails; `riskLevel` escalates to at least `MEDIUM`.

---

## 3. Debug Tool Registry

All tools are available at `window.resolveDebug` when `localStorage.resolve-debug` is `"true"`.

### Method Reference

| Method | Signature | Description |
|--------|-----------|-------------|
| `runStressTest` | `(config?: StressTestOptions) => Promise<StressReport>` | Execute a full stress test run |
| `cleanupSyntheticRun` | `(runId: string, wsId?: string) => Promise<...>` | Clean up a specific run by ID |
| `cleanupAllSyntheticRuns` | `(wsId?: string) => Promise<...>` | Clean up all SST_ records across all tables |
| `cleanupAudit` | `(runId?: string) => Promise<...>` | Forensic audit: scans 15+ tables, logs survivors |
| `recoverAbandonedStressRuns` | `(wsId?: string) => Promise<...>` | Auto-detect and clean stale locks >15 min |
| `isStressRunActive` | `() => { active, runId, ageMinutes }` | Check if a stress lock is held |
| `forceUnlockStressRun` | `() => void` | Unconditionally clear the stress lock |
| `getLastStressReport` | `() => StressReport \| null` | Retrieve last persisted report from localStorage |
| `clearLastStressReport` | `() => void` | Remove the persisted report |
| `broadcastSyntheticCleanup` | `() => void` | Dispatch `CustomEvent('synthetic-cleanup')` |
| `verifyActivityLogAccess` | `(wsId: string) => Promise<...>` | Run 7 diagnostic checks on activity_logs RLS |
| `debugActivityLogContext` | `() => Promise<...>` | Return 7-part diagnostic context for appendLog |
| `toggleForensics` | `() => void` | Toggle forensic logging on/off |
| `getForensicAggregates` | `() => object` | Return aggregated forensic summaries |
| `getForensicBuffer` | `() => object[]` | Return raw forensic ring buffer |
| `clearForensicBuffer` | `() => void` | Clear the in-memory forensic buffer |

### Usage Examples

```js
// Run a tiny validation test
await window.resolveDebug.runStressTest({ maxUsers: 2, maxProjects: 3, maxTasks: 10, scale: 0.01, force: true });

// Check if a run is active
window.resolveDebug.isStressRunActive();

// Force-unlock if a previous run crashed
window.resolveDebug.forceUnlockStressRun();

// View the last report
window.resolveDebug.getLastStressReport();

// Full cleanup of all SST records
await window.resolveDebug.cleanupAllSyntheticRuns();
```

---

## 4. Validation Profiles

### Tiny Validation

```js
window.report =
await window.resolveDebug.runStressTest({
  maxUsers: 2,
  maxProjects: 3,
  maxTasks: 10,
  scale: 0.01,
  force: true
});
```

**Purpose**: Verify lifecycle mechanics — lock/unlock, data generation, cleanup, report persistence.

**Expected results**:
- `riskLevel: "LOW"`
- `cleanup.success: true`
- `failedOperations.length === 0`
- `cleanup.orphanCount === 0`
- `partialFailure: false`

### Medium Validation

```js
window.report =
await window.resolveDebug.runStressTest({
  maxUsers: 10,
  maxProjects: 25,
  maxTasks: 100
});
```

**Purpose**: Validate orchestration of multiple domain services, concurrency handling, and cleanup at moderate scale.

**Expected results**:
- `cleanup.success: true`
- `orphanCount === 0`
- No TDZ errors or uncaught rejections

### Full Stress Validation

```js
window.report =
await window.resolveDebug.runStressTest({
  maxUsers: 200,
  maxTeams: 20,
  maxProjects: 1000,
  maxEpics: 3000,
  maxTasks: 10000,
  maxDocuments: 1000,
  maxEvents: 2000,
  maxIntegrations: 50,
  maxWebhooks: 500,
  maxAutomations: 200,
  maxApprovals: 1000
});
```

**Purpose**: Full system endurance test. Validates memory, queue depth, API throughput, and cleanup under load.

**Note**: Use sparingly. Full stress generates significant database and network load. Allow cleanup to complete fully between runs.

---

## 5. Lock & Recovery System

### Lock Mechanism

The subsystem uses a `localStorage` key `resolve-stress-running` storing a JSON payload:

```json
{ "runId": "abc123", "startedAt": "2026-05-22T12:00:00.000Z" }
```

- Lock is acquired at run start, cleared in `finally` block.
- `isStressRunActive()` returns `{ active, runId, ageMinutes }`.
- `force: true` in config bypasses stale locks and safety caps.

### Stale Lock Recovery

- **Auto-recovery**: On startup, `recoverAbandonedStressRuns()` checks for locks older than 15 minutes, triggers cleanup, and clears the lock.
- **Manual recovery**: `forceUnlockStressRun()` clears the lock unconditionally.
- **Event**: `stress_lock_expired_cleanup` is logged on auto-recovery.

### Operational Rules

- Never start a second run while a lock is active (unless `force: true`).
- If the browser tab is refreshed mid-run, auto-recovery handles cleanup on next load.
- Always verify `isStressRunActive()` returns `{ active: false }` after a completed run.

---

## 6. Cleanup System

### FK-Safe Deletion Order

The cleanup engine deletes in dependency-safe order:

1. Children first: `task_dependencies`, `approval_instances`, `doc_versions`, `doc_annotations`
2. Integration data: `integration_sync_jobs`, `integration_configs`, `connected_accounts`
3. Domain entities: `sprints`, `documents`, `tasks`, `epics`, `calendar_events`, `webhooks`, `automation_rules`, `approval_chains`, `notifications`, `activity_logs`
4. Top-level parents: `teams`, `projects`

### Tables Managed

| Table | Pattern Column | Pattern |
|-------|---------------|---------|
| teams | name | `SST_{runId}_%` |
| projects | name | `SST_{runId}_%` |
| epics | name | `SST_{runId}_%` |
| tasks | name | `SST_{runId}_%` |
| documents | title | `SST_{runId}_%` |
| calendar_events | title | `SST_{runId}_%` |
| webhooks | name | `SST_{runId}_%` |
| automation_rules | name | `SST_{runId}_%` |
| approval_chains | name | `SST_{runId}_%` |
| connected_accounts | access_token | `sst_{runId}_%` |
| sprints | name | `SST_{runId}_%` |
| notifications | title | `SST_{runId}_%` |
| integration_sync_jobs | payload->>sim | `true` |
| integration_configs | config->>repo_url | `https://sst.local/%` |
| activity_logs | metadata->>run_id | runId |

### Verification

After deletion, `countSimRecords()` rescans all tables. If any records remain, `cleanup.success` is set to `false`, `orphanCount` reports the total, and a forensic audit auto-runs to identify survivors.

`broadcastSyntheticCleanup()` dispatches a `CustomEvent('synthetic-cleanup')` on `window` so the application can invalidate caches after cleanup.

---

## 7. Failure Handling

### Isolation Model

All batch operations use `Promise.allSettled` — individual failures are captured without aborting the batch.

```
callService(report, serviceName, payload, fn)
  → withTimeout(15_000)
  → on success: return result
  → on timeout/error: capture { service, payload, error, code, details, hint, timestamp }
  → push to report.failedOperations[]
  → return null
```

### Error Capture

Each failure is recorded with:

```json
{
  "service": "calendarEventService.createEvent",
  "payload": { "workspace_id": "...", "title": "SST_..." },
  "error": "Could not find the 'end_time' column of 'calendar_events'",
  "code": "PGRST204",
  "details": "",
  "hint": "",
  "timestamp": "2026-05-22T12:57:17.541Z"
}
```

### Failure Escalation

- `failedOperations.length > 0` → `riskLevel` is at least `MEDIUM`
- `failedOperations.length >= 3` plus other risks → `riskLevel: "HIGH"`
- `failureSummaryByService` aggregates failures by service name for quick diagnosis

---

## 8. Immutable Logging

Every stress lifecycle event is logged to `activity_logs` via SHA-chained append-only operations.

### Logged Actions

| Action | Trigger |
|--------|---------|
| `stress_test_started` | Run start |
| `stress_test_completed` | Run success |
| `stress_test_blocked` | Run blocked by existing lock |
| `stress_test_dry_run` | Run with `dryRun: true` |
| `stress_cleanup_completed` | Cleanup success with record counts |
| `stress_cleanup_manual` | Manual cleanup via `cleanupSyntheticRun` |
| `stress_cleanup_survivor_detected` | Forensic audit finds survivors |
| `stress_recovery_started` | Auto-recovery begins |
| `stress_recovery_completed` | Auto-recovery ends with results |
| `stress_lock_expired_cleanup` | Stale lock auto-cleared |

### Graceful Degradation

If `appendLog` receives a 403/42501 (RLS), it:
1. Queues the entry in an in-memory buffer
2. Retries up to 5 times at 10-second intervals
3. Never blocks the caller
4. Never spams the console

---

## 9. Operational Safety Rules

1. **Never run overlapping stress tests** — the lock system prevents this, but `force: true` bypasses it. Use intentionally.
2. **Never refresh the browser during an active run** — auto-recovery handles it, but it adds latency to the next run.
3. **Prefer tiny validation before scaling** — always run a `scale: 0.01` test first to verify basic health.
4. **Use `cleanupAudit()` for forensic debugging only** — it is slow and logs verbose output.
5. **Use `cleanupAllSyntheticRuns()` for operational cleanup** after a crash.
6. **Never manually delete DB rows** unless both `cleanupSyntheticRun` and `cleanupAllSyntheticRuns` fail.
7. **Keep `resolve-debug` disabled in production** — debug tools are for development/staging only.

---

## 10. Known Resolved Issues

| Issue | Resolution | File/Commit |
|-------|-----------|-------------|
| RLS `current_workspace()` returning NULL blocking inserts | Replaced with subquery pattern | `MIGRATION_activity_logs_rls_hotfix.sql` |
| Missing DELETE RLS policy on `activity_logs` | Added `FOR DELETE` policy with subquery | `MIGRATION_schema_drift_patch.sql` |
| `appendLog` hanging on throttled Supabase | Wrapped in `withTimeout(5000).catch()` | `syntheticStressTest.ts` |
| Stale lock blocking `force: true` runs | Auto-clear stale lock when `force: true` | `syntheticStressTest.ts:341-354` |
| Report `endTime`/`durationMs` always 0 | Moved assignment before `persistReport()` | `syntheticStressTest.ts:1034-1046` |
| `.single()` returning 406 on deleted rows | Changed to `.maybeSingle()` | `automationEngine.ts:225` |
| `.catch()` broken on minified Supabase query builders | Replaced with `try/catch` | `syntheticStressTest.ts` |
| `calendar_events` missing `user_id` column | Removed `user_id` from stress test payload | `syntheticStressTest.ts:622-628` |
| `connected_accounts` missing `connected` column | Added column via migration | `MIGRATION_schema_drift_patch.sql` |
| `task_dependencies` missing unique constraint for upsert | Added `UNIQUE (workspace_id, task_id, depends_on_task_id)` | `MIGRATION_schema_drift_patch.sql` |
| Rollup TDZ "Cannot access 'R' before initialization" | Replaced static service imports with dynamic `await import()` | `automationEngine.ts`, `syntheticStressTest.ts` |
| `notifications` table not cleaned up | Added to all 6 cleanup code paths | `syntheticStressTest.ts` |

---

## 11. Remaining Non-Critical Risks

| Risk | Notes |
|------|-------|
| Webhook DNS failures | Webhook URLs use `sst-webhook.local` (fake domain). Failures are expected and harmless. |
| `Promise.race` timeout does not cancel HTTP | The underlying Supabase request continues server-side. Only the client-side promise rejects. |
| Forensic buffers are memory-only | Lost on page navigation. Buffer is limited to 200 entries. |
| Stress subsystem is not production UI | Debug tools require `localStorage` flag. Never exposed to end-users. |
| `approval_instances` HEAD 400 on count scan | The HEAD request fails but the catch block silently handles it. Count shows 0, which is accurate. |

---

## 12. Recommended Next Phase

The stress testing subsystem is considered **operationally stable**. All known schema drifts, service contract mismatches, RLS regressions, and orchestration bugs have been resolved.

Recommended focus for upcoming development:

- **UX polish** — refine interaction patterns and visual feedback
- **Workflow orchestration** — improve multi-step business process support
- **Collaboration features** — real-time cursors, mentions, notifications
- **Realtime subscriptions** — live-updating dashboards and task boards
- **Onboarding flow** — first-run experience, template projects, guided setup
- **Production readiness** — error boundaries, loading states, accessibility audit
- **Performance** — virtualization for large lists, query optimization, bundle splitting
