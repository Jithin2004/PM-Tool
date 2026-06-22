# Deep Master Audit: Business Logic & Structural UX Placement

This report presents a comprehensive audit of the Resolve PM platform, dissecting the massive layer of nested UI tabs across all categories. It evaluates two critical dimensions for every UI element:
1. **[EVALUATION A - Business Logic]**: Is the feature fully wired to the Supabase backend or simply mocked/state-driven?
2. **[EVALUATION B - Structural Restructuring]**: Does the UI element make logical sense, or should it be merged, promoted, or separated to reduce cognitive load?

---

## 1. ADMIN PANEL & WORKSPACE SETTINGS
**Current Placement:** `/control/settings`, `/control/identity`, `/control/audit` (Massive nesting: 4 Top Tabs $\rightarrow$ 14 Sub-Tabs $\rightarrow$ Inner Component Pills).

### 1.1 Working Rules & Organization
- **Business Logic**: **[FULLY WIRED]**. Connected to `workspace_settings` table (JSONB `settings_blob` and column overrides like `working_time_from`, `default_mode`).
- **UX Recommendation**: **[MERGE]**. "Organization" and "Working Rules" are artificially separated. Combine them into a single "General Setup" scrollable pane.

### 1.2 People Rules & Governance
- **Business Logic**: **[FULLY WIRED]**. Updates `attendanceEnabled`, `payrollEnabled`, and `productivityFactor` in `workspace_settings`.
- **UX Recommendation**: **[SEPARATE MODULE]**. This is fundamentally HR logic. Move this entirely out of Admin settings and merge it into the "People Operations" top-level domain.

### 1.3 Security & Password Policy
- **Business Logic**: **[FULLY WIRED]**. Updates `passwordPolicy` and `magicLinkExpiry` in `workspace_settings`.
- **UX Recommendation**: **[CLUB]**. Merge "Security" and "Client Access" into a single "Access Control" tab. They govern the same authentication boundaries.

### 1.4 Export & Backup / System Logs
- **Business Logic**: **[FULLY WIRED]**. `system_audit_ledger` provides cryptographic WORM-like logs. Export triggers JSON generation of `projects`, `tasks`, `teams`, etc.
- **UX Recommendation**: **[PROMOTE]**. Move "System Health", "Audit Logs", and "Backup" into a dedicated "System & Security" module accessible only by Super Admins, removing them from the standard workspace settings clutter.

---

## 2. TASK INNER VIEWS (EXECUTION ENGINE)
**Current Placement:** `DashboardLayout.tsx` defines Tasks Domain $\rightarrow$ Task Board, Timeline, Calendar, Sprints.

### 2.1 Task Board (Kanban) & Sprints (Scrum)
- **Business Logic**: **[FULLY WIRED]**. Deeply integrated with `tasks` table, updating `status`, `sprint_id`, and `pert_best/likely/worst` estimation columns.
- **UX Recommendation**: **[MERGE / TOGGLE]**. Stop treating Kanban and Sprints as completely separate navigational destinations. They are simply different *views* of the same backlog. Provide a single "Execution Board" with a quick-toggle pill (Board | List | Sprint).

### 2.2 Roadmap, Gantt, & Calendar (Timeline)
- **Business Logic**: **[FULLY WIRED]**. Reads from `tasks` temporal fields (`start_date`, `deadline`, `predicted_completion`) and `task_dependencies`.
- **UX Recommendation**: **[CLUB]**. Combine "Timeline", "Gantt", and "Calendar" into a single "Schedule" tab. Allowing the user to zoom in/out changes the view from Calendar (days) to Gantt (weeks) to Roadmap (months).

### 2.3 Team Allocation & Capacity Workload
- **Business Logic**: **[FULLY WIRED]**. Connected to `project_allocations`, `allocation_periods`, and dynamic `availability_factor` calculations.
- **UX Recommendation**: **[PROMOTE]**. Currently buried under "Resources $\rightarrow$ Capacity". Resource allocation is critical for PMs. Promote this to a top-level tab in the Execution Engine ("Capacity Planning").

---

## 3. PROJECT APPROVALS & REQUIREMENTS
**Current Placement:** `/workspace/portfolio`, `/workspace/requirements`, `/workspace/approvals` + `ProjectDetailsModal.tsx`.

### 3.1 Project Requirements
- **Business Logic**: **[FULLY WIRED]**. Connects to `projects` metadata, `files` for attachments, and `comments`.
- **UX Recommendation**: **[MERGE]**. Requirements should not be a separate top-level route. They belong inside the individual Project Dashboard (e.g., a "Brief" tab within the project).

### 3.2 Project Approvals (Sign-offs & Change Requests)
- **Business Logic**: **[FULLY WIRED]**. Wired to the `project_signoffs` and `wait_states` tables, tracking exact approver IDs and timestamps.
- **UX Recommendation**: **[MERGE & PROMOTE]**. Extract Approvals from the generic workspace list and create a global, persistent "Action Items / Inbox" in the Top Navbar. Approvals shouldn't be a destination; they should come to the user.

### 3.3 Project Friction & State Tracking
- **Business Logic**: **[FULLY WIRED]**. Tracks manual/automatic state changes (`active`, `passive_wait`, `blocked`) into `workspaceSettingsBlob`.
- **UX Recommendation**: **[LOGICAL]**. The placement inside `ProjectDetailsModal` is excellent, as it provides contextual governance right where project managers adjust statuses.

---

## 4. FINANCE SUB-TABS
**Current Placement:** `/resources/finance` with inner tabs for Reports, Invoices, Budgets, Forecast.

### 4.1 Payroll & Salaries
- **Business Logic**: **[FULLY WIRED]**. Aggregates data from the `salaries` table, cross-referenced with `employmentRecords` and `attendance` factor.
- **UX Recommendation**: **[SEPARATE]**. Payroll is strictly internal. Move it to the "People Operations" module under "Compensation", keeping the Finance module focused on client revenue and company profit.

### 4.2 Budgets & Expenses
- **Business Logic**: **[FULLY WIRED]**. Connected to `expenses` table, tracking billable vs internal costs.
- **UX Recommendation**: **[CLUB]**. Merge "Budgets" into the Project Details view. Project Managers need to see their project's burn rate in context, not in a disconnected global finance tab.

### 4.3 Invoices, Receivables, & Client Credits
- **Business Logic**: **[FULLY WIRED]**. Connects to `invoices`, `payments`, `company_billing_profile`. It includes logic for tax generation, advance payments, and credit notes.
- **UX Recommendation**: **[PROMOTE]**. The "Finance & Billing" module is far too complex and powerful to be a sub-tab under "Resources". Promote it to a primary Top-Bar Module (on par with Execution and Projects).

### 4.4 Financial Ledgers & Forecast (Period Closing)
- **Business Logic**: **[FULLY WIRED]**. Highly sophisticated backend wiring utilizing `financial_periods`, `financial_snapshots`, and `financial_adjustments`. Includes hard locks for closed periods.
- **UX Recommendation**: **[LOGICAL]**. Keep this exactly where it is. The Command Center / Ledger view is beautifully structured for financial controllers.

---

## 5. GLOBAL ARCHITECTURE VERDICT & RESTRUCTURING PLAN

### The "Tab Hell" Problem
The application currently suffers from **"Tab Hell"**. For example, to change an employee's salary, a user clicks: Resources $\rightarrow$ Finance $\rightarrow$ Payroll Tab $\rightarrow$ Edit Pill. To see project workload, they click: Team $\rightarrow$ Team Workload.

### Recommended 4-Pillar Navigation Restructuring
Collapse the 10 Executive Domains and 30+ sub-tabs into a **4-Pillar Top Navigation**, relying on continuous scrolling and side-panels rather than nested routing:

1. **MISSION CONTROL (The PM's Desk)**
   - Merges: Dashboard, Inbox, Approvals, Activity Feed, and Daily Command.
   - *UX shift*: Everything that needs *action today* lives here.

2. **EXECUTION (The Work)**
   - Merges: Projects, Task Board, Sprints, Timeline, and Requirements.
   - *UX shift*: One unified board. Filters handle whether you are looking at Epics (Projects) or Tasks (Sprints/Kanban).

3. **COMPANY (The Resources)**
   - Merges: Team roster, Skills Matrix, Capacity/Workload, Attendance, Payroll, and Departments.
   - *UX shift*: A single truth-source for all human capital and their utilization.

4. **FINANCE & ADMIN (The Business)**
   - Merges: Invoicing, Budgets, Ledger, Client Access, and Workspace Settings.
   - *UX shift*: Separates the "delivery of work" from the "business of the company".

### Conclusion on Business Logic
Almost **zero** of the platform is mocked. The data layer is incredibly robust, featuring advanced schema designs (cryptographic audit ledgers, financial period snapshots, acyclic dependency graphs, and temporal drift tracking). 

The issue is entirely on the presentation layer: the UI is surfacing the database schema directly as tabs, rather than abstracting it into user-centric workflows. Implementing the UI merging recommendations above will transform the platform from a "Database Viewer" into a "Premium Management Tool".
