# Resolve PM: Deep-Scan Architectural Audit

This document outlines the findings of a comprehensive architectural audit of the Resolve PM codebase, focusing on logical vulnerabilities, data integrity, and production readiness.

## 1. Logic Flow Analysis

### Auth Flow & Token Expiry
**Finding:** Robust, but has a slight edge-case risk.
- **Mechanism:** In `AuthContext.tsx`, when `onAuthStateChange` detects a `SIGNED_OUT` or `TOKEN_REFRESHED` (with no session) event, it triggers `handleSessionExpiry()`.
- **Action:** The system gracefully purges sensitive `localStorage` keys (e.g., `tasks_`, `projects_`, `offline_task_queue_`) and safely calls `navigateTo('/', true)` to force a hard reload.
- **Vulnerability:** If the browser blocks `localStorage` or `indexedDB` (e.g., strict incognito mode), Supabase fails to persist the session. The 10-second `safetyTimeoutRef` prevents infinite hangs, but the user may be trapped in a repetitive login loop without a clear UI error explaining *why* cookies/storage must be enabled.

### RBAC Flow & Frontend Blind Spots
**Finding:** UI relies too heavily on database perfection.
- **Mechanism:** The frontend correctly utilizes `member_role` (e.g., in `ExecutionBoard.tsx`) to conditionally render `+Task` buttons and drag-and-drop features.
- **Vulnerability:** "Blind Trust." If a backend developer accidentally drops an RLS policy or introduces a flaw in the PostgreSQL `CREATE POLICY` block, the frontend will blindly render whatever payload it receives. Components lack secondary client-side filtering (e.g., `tasks.filter(t => t.workspace_id === currentWorkspace)`), meaning a backend misconfiguration immediately results in a catastrophic cross-tenant data leak on the UI.

---

## 2. Data Integrity Audit

### The `select('*')` Epidemic
**Finding:** CRITICAL OVER-FETCHING.
- **Scan Results:** Discovered **over 200 instances** of `.select('*')` across the `src/services/` directory (e.g., `approvalService.ts`, `automationEngine.ts`, `financeService.ts`).
- **Vulnerability:** While Supabase RLS protects *rows*, `select('*')` exposes all *columns*. If an engineer later adds a sensitive column to a public table (e.g., `internal_margin`, `raw_oauth_tokens`, `admin_notes`), it will automatically be broadcasted to the frontend payload for every user. 
- **Recommendation:** Refactor queries to explicitly declare required columns: `.select('id, name, status, project_id')`.

### Missing Error Boundaries
**Finding:** High risk of "White Screen of Death".
- **Mechanism:** Many nested components directly execute async `supabase` queries and `throw error` to the nearest `catch` block.
- **Vulnerability:** If an unhandled promise rejection occurs during React rendering (or a component assumes `data.tasks[0].name` exists but `data.tasks` is undefined due to an RLS block), the entire React component tree will crash. There is a lack of localized `<ErrorBoundary>` wrappers around volatile widgets like the `ClientBillingView` or `ExecutionBoard`.

---

## 3. Security & Hygiene

### Service Role Leakage
**Finding:** SECURE.
- **Scan Results:** A deep scan for `SERVICE_ROLE_KEY` and `supabase_service` within the `/src` directory returned zero results.
- **Status:** The frontend correctly utilizes the `anon` key, deferring privileged operations (like Client Provisioning) to Edge Functions.

### Hardcoded Secrets & Stubs
**Finding:** Minor technical debt.
- **Scan Results:** No raw API keys were found. However, there are lingering "Simulated" stubs.
  - Example: `commercialRequestService.ts` contains `console.log('Simulated Commercial Request Submission:', request);`.

---

## 4. Edge Case QA

### Session State Integrity
**Finding:** Graceful degradation needs refinement.
- **Mechanism:** If the session state evaluates to `null` (e.g., network drop, deleted user), `AuthContext` sets `profile` to `null`.
- **Vulnerability:** Because `AuthContext` relies on an exhaustive list of prefixes to clear storage during expiry (e.g., `if (key.startsWith('tasks_')) localStorage.removeItem(key)`), any newly added offline cache key (like `time_logs_`) that isn't explicitly added to the purge list will permanently leak data to the next user who logs into that shared computer.

---

## 5. Final Production Checklist

### Rogue Console Logs
**Finding:** Production noise.
- Multiple `console.log` statements were left in production services:
  - `financeLedgerService.ts`: Logging journal entry duplications.
  - `financeMigrationService.ts`: Logging migration counts.
  - `sandboxSeedEngine.ts`: Verbose generation logs.
- **Recommendation:** Replace with a structured logging utility that mutes output when `import.meta.env.PROD` is true.

### useEffect Dependency Arrays
**Finding:** Stale Closure Risks.
- Several complex dashboard components have `useEffect` hooks relying on Supabase Realtime WebSockets. Due to the rapid state mutations, some functional dependencies are missing from the arrays, which may lead to components rendering stale data if a WebSocket packet arrives out of order.
