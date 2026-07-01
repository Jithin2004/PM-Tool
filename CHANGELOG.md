# Changelog

## v1.3.2 (Current Release)

### Added
- Mission Control dashboard for global operational oversight.
- Dedicated Team Management workspace (Teams module).
- Complete two-session model for Attendance (Clock In/Out) and Work Session context tracking.

### Changed
- Refactored `DashboardLayout` and `AdminPanel` navigation menus to align with enterprise expectations.
- Removed development logs, temporary TODO markers, and hardcoded `localhost` endpoints.
- Standardized UI forms with asterisk (*) markers for required fields and explicit (Optional) labels.
- Performance optimization: Extracted active dashboard timers into lightweight `<ActiveTimer />` components.

### Fixed
- Playwright E2E test failures caused by `current_workspace()` database desync.
- Resolved dangling syntax error (`}`) in React router.
- Graceful empty-state handling across Projects, Teams, Capacity, and Mission Control modules.
- Notification permission edge cases (`unsupported` browsers and `private_error` privacy blocks) resolved.

### Security
- Enforced strict schema qualification (`public.current_workspace()`) across 169+ SQL references to prevent `search_path` injection vulnerabilities.
- Audited RLS (Row Level Security) ensuring 100% tenant isolation via `workspace_id`.

### Database
- Consolidated all SQL patches into single canonical source (`RESOLVE_PM_V1_3_INSTALL.sql`).
- Resolved `ERROR: cannot change routine language` by removing duplicate `plpgsql` implementation of `current_workspace()`.
- Idempotent execution verified for `work_sessions` tracking tables.

### Certification
- Final Release Gate (RC) passed successfully.
- Completed and archived Sandbox Integrity Certification v1.5.
- Repository integrity audit completed with 100% confidence.
