# Resolve PM Enterprise Architecture

## Overview
Resolve PM Enterprise is a comprehensive project and portfolio management solution designed for large-scale enterprise deployments. The application follows a modern monolithic architecture with a React frontend (`vite`, `tailwindcss`, `lucide-react`) communicating via HTTP/WebSocket to a Supabase-powered PostgreSQL backend.

## Data Domains

The data model is strictly partitioned into business domains to ensure integrity and scalability:

1. **Projects & Tasks (`projects`, `tasks`, `epics`, `stories`)**
   - The core operational data model handling execution hierarchies.
   - Tied to `workspaces` for multi-tenant isolation.

2. **Team Management (`teams`, `team_members`)**
   - Handles the organizational structure mapping users to cross-functional teams.
   - Informs capacity and workload forecasting.

3. **Attendance & Time Tracking (`clock_events`)**
   - Tracks human capital availability (Clock In, Clock Out, Pauses, Leave).
   - Independent of task-based work tracking.

4. **Work Sessions (`work_sessions`)**
   - Canonical source for operational work allocation.
   - Linked to `attendance_session_id` to strictly correlate operational output with logged hours.
   - Enforces a "two-session" model when paused/resumed to ensure accurate context switching analytics.

5. **Auditing (`activity_logs`)**
   - General-purpose append-only log for all significant state changes.

## RBAC Model
Role-Based Access Control is enforced at two layers:
1. **Frontend**: The `hasCapability` function maps roles (`super_admin`, `admin`, `pm`, `team_lead`, `developer`, `employee`, `hr`, `finance`, `client`) to specific capabilities (e.g. `team.manage`).
2. **Backend**: Row Level Security (RLS) policies enforce data partitioning, ensuring a user only accesses records tied to their `workspace_id`.

## Key Modules
- **Mission Control**: The central nerve center for daily operations, featuring live attendance tracking, active work session timers, and real-time observability signals.
- **Team Management**: Dedicated workspace to visualize team structures, current workload, assigned projects, and capacity metrics.
