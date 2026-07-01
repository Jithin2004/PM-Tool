# Known Limitations (v1.3.2)

As of the v1.3.2 release, the following known limitations are present in the architecture. These are largely intentional boundaries drawn to stabilize the 1.3 schema and are targeted for resolution in the v1.4 roadmap.

## 1. Integrations and Automations
- **Webhooks & Syncing**: Currently, external integrations (e.g., Jira, Slack, MS Teams) are stubbed in the UI (`Reserved for future Integrations module`). The backend engine exists but lacks a generic OAuth mapping UI in this release.
- **Workflow Automations**: Automated status transitions and custom triggers are currently hardcoded or disabled. A visual automation builder is planned for v1.4.

## 2. Advanced RBAC
- Custom Roles: Role definitions are currently strict (`super_admin`, `admin`, `pm`, etc.). The capability mapping (`hasCapability`) is robust, but there is no UI for tenants to create custom permutations of these roles.

## 3. Financial & Billing Engines
- Real-time billing engines and deep financial ledger tracking are architected but mostly hidden behind feature flags. Deep ERP integrations are not supported in 1.3.

## 4. Work Sessions Context Switching
- While Work Sessions accurately track exact context times, complex branching (e.g., pausing a task to work on a meeting, and then resuming the original task) creates separate linear sessions rather than a nested tree. This is intentional for tabular reporting but may limit deep hierarchical time visualization.

## 5. Mobile Support
- The frontend is built on Tailwind CSS and uses responsive classes, but it is optimized as a desktop enterprise web application. Mobile tablet web usage works, but small-screen phone layouts may experience horizontal scrolling in complex Gantt/Timeline views. A dedicated mobile application is outside the scope of 1.3.
