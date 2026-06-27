const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../database/production/RESOLVE_PM_V1_3_INSTALL.sql');
let sql = fs.readFileSync(filePath, 'utf8');

// Replace old capabilities with new dot-notation capabilities
const capMap = {
    'platform_governance': 'workspace.update',
    'manage_settings': 'settings.manage',
    'view_projects': 'project.view',
    'manage_projects': 'project.update',
    'view_tasks': 'task.view',
    'manage_tasks': 'task.update',
    'view_scheduling': 'timeline.view',
    'manage_scheduling': 'timeline.manage',
    'view_analytics': 'dashboard.view',
    'view_reports': 'reports.view',
    'manage_logistics': 'workspace.update',
    'view_teams': 'people.view',
    'manage_teams': 'people.manage',
    'manage_integrations': 'integration.manage',
    'manage_automations': 'automation.manage',
    'manage_employees': 'people.manage',
    'manage_attendance': 'attendance.manage',
    'manage_employment_records': 'hr.private_records',
    'manage_payroll': 'finance.manage',
    'manage_finance': 'finance.manage',
    'manage_invoice': 'invoice.manage',
    'manage_expenses': 'expense.manage',
    'view_audit_log': 'audit.view',
    'manage_security': 'audit.security'
};

// Replace insertions of capabilities
for (const [oldCap, newCap] of Object.entries(capMap)) {
    // We don't want to replace string literals that are not capabilities, but here they are unique enough.
    // Also, we need to handle the capability definition list if there is one.
    sql = sql.replace(new RegExp(`'${oldCap}'`, 'g'), `'${newCap}'`);
}

// Now replace hardcoded role checks in RLS policies.
// Pattern: users.role = 'super_admin' inside an EXISTS clause
// Pattern: role = 'super_admin' inside a table policy where we can check has_capability

// It's much safer to replace specific patterns.
// Pattern: AND (users.role = 'super_admin') or similar
sql = sql.replace(/AND\s+users\.role\s*=\s*'super_admin'/gi, "AND public.has_capability(auth.uid(), 'workspace.update')");
sql = sql.replace(/AND\s+users\.role\s*=\s*'pm'/gi, "AND public.has_capability(auth.uid(), 'project.update')");
sql = sql.replace(/AND\s+users\.role\s*=\s*'admin'/gi, "AND public.has_capability(auth.uid(), 'workspace.update')");

sql = sql.replace(/WHERE\s+users\.id\s*=\s*auth\.uid\(\)\s+AND\s+users\.role\s*=\s*'super_admin'/gi, "WHERE users.id = auth.uid() AND public.has_capability(auth.uid(), 'workspace.update')");

sql = sql.replace(/AND\s+role\s*=\s*'super_admin'/gi, "AND public.has_capability(auth.uid(), 'workspace.update')");
sql = sql.replace(/OR\s+role\s*=\s*'super_admin'/gi, "OR public.has_capability(auth.uid(), 'workspace.update')");

// Fix `me.role = 'super_admin'`
sql = sql.replace(/AND\s+me\.role\s*=\s*'super_admin'/gi, "AND public.has_capability(auth.uid(), 'workspace.update')");

// Fix trigger checks
sql = sql.replace(/IF\s+OLD\.role\s*=\s*'super_admin'/gi, "IF public.has_capability(OLD.id, 'workspace.update')");
sql = sql.replace(/NEW\.role\s*!=\s*'super_admin'/gi, "NOT public.has_capability(NEW.id, 'workspace.update')");

fs.writeFileSync(filePath, sql);
console.log('Fixed SQL permissions');
