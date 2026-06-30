# Changelog

## v1.3.2

### Added
- None.

### Changed
- Finalized pre-release source cleanup audit for frontend and backend.
- Purged temporary operational flags, test runner logs, and debug markers (`console.log`, `debugger`).
- Removed obsolete test utilities and historical migration files.

### Fixed
- Playwright E2E test failures caused by `current_workspace()` database desync.
- Resolved dangling syntax error (`}`) in React router.

### Security
- Enforced strict schema qualification (`public.current_workspace()`) across 169+ SQL references to prevent `search_path` injection vulnerabilities.

### Database
- Consolidated all SQL patches into single canonical source (`RESOLVE_PM_V1_3_INSTALL.sql`).
- Resolved `ERROR: cannot change routine language` by removing duplicate `plpgsql` implementation of `current_workspace()`.
- Deduplicated `prevent_user_hard_delete` and retained test-cleanup bypass logic.
- Deduplicated `prevent_user_hard_delete_trigger` block.

### Certification
- Completed and archived Sandbox Integrity Certification v1.5.
- Completed and archived Sandbox Recovery Report v1.5.
- Repository integrity audit completed with 100% confidence.    
