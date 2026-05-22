# Resolve PM v2 Migration Plan

This migration keeps the existing app usable while moving the product toward the Resolve PM promise: deadlines based on how humans actually work.

## Refactor Reasoning

- Preserve the current React, Supabase, Gemini, PERT, admin, dashboard, and board code.
- Stop growing `App.tsx`; new work lands in routed pages, services, hooks, and focused components.
- Move ETA and productivity calculations out of UI components so Dashboard, Board, Gantt, Notifications, and Activity all read from the same engine.
- Keep existing Supabase tables stable during transition, then migrate into workspace-scoped tables.
- Rename user-facing concepts to familiar PM language while avoiding destructive database renames in the first pass.

## Phase 1: Architecture, Auth, Workspace, Roles

- Add `src/app`, `src/pages`, `src/context`, `src/types`, and `src/constants`.
- Route new onboarding and project creation surfaces through `src/app/router.tsx`.
- Keep the legacy workspace mounted as the default route until features are migrated.
- Introduce `workspaces` and workspace-aware RLS policies.
- Store work window, lunch duration, timezone, attendance, payroll, and productivity settings on the workspace.

## Phase 2: Projects, Tasks, Teams

- Introduce workspace-scoped `projects`, `tasks`, `teams`, and `users`.
- Migrate current `profiles` into `users`.
- Migrate current `teams.data` into typed team/member rows.
- Migrate current `tactical_tasks` into canonical `tasks`.

## Phase 3: Task Lifecycle and Board

- Replace legacy board lanes with `Backlog`, `In Progress`, `Review`, `Done`.
- Add `@dnd-kit` after dependency installation approval.
- Task movement writes activity logs, sends notifications, and calls the ETA service.

## Phase 4: ETA Engine

- Expand `services/etaService.ts` to include attendance, availability, team load, dependency delay, and interruptions.
- Remove remaining inline ETA logic from `App.tsx` as screens are split.
- Persist ETA metadata on projects/tasks only as derived snapshots, not separate source data.

## Phase 5: Dynamic Gantt

- Add Gantt package after dependency installation approval.
- Use canonical `tasks` and `task_dependencies`.
- Recalculate overlays when attendance, team load, work windows, or dependency dates change.

## Phase 6: Dashboard and Notifications

- Build auto-generated dashboard widgets from canonical workspace data.
- Add notification center for assignments, deadlines, risk, attendance, and system events.

## Phase 7: Files and Activity

- Add Supabase Storage buckets for avatars, attachments, project files, and exports.
- Add file metadata and activity log views per project.

## Phase 8: Testing and Optimization

- Add focused service tests for PERT, productivity, and ETA.
- Add integration checks for RLS-sensitive reads/writes.
- Split large UI components as migrated screens stabilize.
