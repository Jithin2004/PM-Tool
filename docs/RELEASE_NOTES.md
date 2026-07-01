# Release Notes: Resolve PM Enterprise v1.3.2

**Release Date:** July 2026

Resolve PM Enterprise v1.3.2 is our most stable, production-hardened release to date. Focused on enterprise architecture consistency and data model separation, this update introduces powerful operational oversight tools while freezing the foundational schema for long-term support.

## Key Highlights

### 1. The Two-Session Operational Model
We have decoupled human attendance from project tracking. `clock_events` now strictly handles Attendance (Clock In/Out), while `work_sessions` manages the specific context of the work being performed.
- True contextual tracking: Resuming work automatically creates a clean, discrete session instead of artificially altering historical timeline boundaries.
- Precise duration tracking and context switching analytics.

### 2. Mission Control
A new, high-performance central command dashboard has been introduced.
- Live observability metrics for Team Loads, Blocker Alerts, and Active Work Sessions.
- Lightweight `<ActiveTimer />` architecture ensures 60 FPS UI performance even with live ticking chronometers.

### 3. Team Management Workspace
The People Ops module has been restructured to cleanly accommodate operational Teams.
- Define cross-functional execution squads with PMs and Developers.
- Live visibility into team capacity and currently assigned portfolios.

### 4. Enterprise UI/UX Standardization
The entire application has been polished to ensure a unified enterprise aesthetic.
- Standardized form modalities.
- Explicit visual cues for required (`*`) vs Optional fields.
- Graceful empty states across all modules for zero-data environments (e.g. brand new workspaces).

### 5. Final Production Certification
This release marks the end of the v1.3 development cycle. 
- All development logs, `localhost` pointers, and temporary development markers have been removed.
- Database schema, API contracts, and RBAC models are strictly frozen. 

*No further features will be introduced to the v1.3.x branch. All future feature requests will be migrated to the v1.4 roadmap.*
