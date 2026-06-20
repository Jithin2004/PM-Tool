# Resolve PM — Fake Company Simulation Checklist (Operational Hardening)

This document describes a 5-day validation script designed to test Resolve PM's operational edge cases under realistic organizational conditions. Do NOT deploy this as a production feature. Use it for local developer/admin validation testing only.

## Simulation Setup

*   **Admin User:** 1 (full capabilities)
*   **HR User:** 1 (manage employees, attendance, payroll)
*   **PM User:** 1 (manage projects, tasks, approvals)
*   **Developers:** 3 (collaborate, work on tasks, submit suggestions)
*   **Client User:** 1 (external client accessing portal via magic link)

---

## Simulation Log & Step-by-Step Verification

### Day 1: Setup & Project Initialization
*   [ ] **Action 1:** PM/Admin creates a new external client in the system.
*   [ ] **Action 2:** PM creates a new project ("Q2 Migration") and configures target dates and teams.
*   [ ] **Action 3:** PM adds client requirements and creates a kickoff meeting.
*   [ ] **Action 4:** PM creates tasks and assigns them to Developer A.
*   [ ] **Expected Outcomes:**
    *   System notifications are triggered for Developer A's assignment.
    *   Activity logs are created for project, client, requirement, and meeting creation.
    *   Cryptographic hash chain in `activity_logs` remains valid.

### Day 2: Execution & Cross-Team Help
*   [ ] **Action 1:** Developer A starts their task (sets status to `in_progress`).
*   [ ] **Action 2:** Developer A encounters a blockade (sets status to `blocked`).
*   [ ] **Action 3:** Developer B is added as a collaborator by the PM to assist Developer A.
*   [ ] **Action 4:** Developer B logs help and effort (logs work session time).
*   [ ] **Expected Outcomes:**
    *   Effort is correctly recorded for both Developer A and Developer B on the same task.
    *   Activity logs record the collaborator insertion and task status transition.

### Day 3: Leave Event & Predictive Analytics
*   [ ] **Action 1:** Developer A goes on approved sick leave for 2 days (HR logs the leave event).
*   [ ] **Action 2:** PM checks the project timeline / timeline intelligence panel.
*   [ ] **Expected Outcomes:**
    *   The project timeline shifts predicted completion by 2 days automatically to account for leave.
    *   The prediction engine outputs constructive explanations: *"Timeline shifted by 2 days because assigned member is unavailable"* rather than scoring it as developer delay.
    *   No negative performance penalty or surveillance scoring is recorded for Developer A.

### Day 4: Finance Lifecycle Hardening
*   [ ] **Action 1:** PM/Finance generates an invoice for the project ("Q2 Migration - Milestone 1") for $10,000.
*   [ ] **Action 2:** Client makes a partial payment of $4,000.
*   [ ] **Action 3:** Client makes the final payment of $6,000.
*   [ ] **Expected Outcomes:**
    *   Invoice status transitions from `issued` to `partially_paid` automatically upon first payment.
    *   Invoice status transitions to `paid` automatically on the final payment.
    *   Invoice is locked forever (cannot be updated/deleted after becoming `paid`).
    *   `invoice_audit_logs` records all state transitions with old/new jsonb values.

### Day 5: Client Portal Security Verification
*   [ ] **Action 1:** PM generates a client magic link with custom permission scopes and sends it to the Client.
*   [ ] **Action 2:** Client opens the magic link to access the shared portal.
*   [ ] **Action 3:** PM revokes the token. Client attempts to access the portal again.
*   [ ] **Expected Outcomes:**
    *   Client can view project progress, approved documents, selected meetings, and approvals.
    *   Client *never* sees internal task comments, developer time logs, developer efficiency metrics, margins, or salaries.
    *   Supabase updates token `last_accessed_at` and increments `access_count` on access.
    *   Access logs record the access event.
    *   After token revocation, Client receives an "Invalid, expired, or revoked access token" error.

---

## Failures Found & Diagnostics

Use this space to log any runtime failures observed during developer testing:

1.  *Schema Cache Out of Sync:* If Supabase fails to read new columns for `external_access_links` after applying migration, run `NOTIFY pgrst, 'reload schema';` in the Supabase SQL editor.
2.  *Developer Re-assignment Block:* Ensure that developers attempting to change assignees via UI get blocked client-side AND database-side via trigger exceptions.
3.  *Leave Prediction Mismatch:* If the timeline prediction does not shift, verify that `calendar_events` are correctly set with type `leave` and match the task assignee.
