const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const sqlFile = path.join(__dirname, '..', 'database', 'production', 'RESOLVE_PM_V1_3_INSTALL.sql');

const requiredFiles = [
  // Phase 1A
  'entityLinkService.ts', 'activityEventService.ts', 'uidService.ts', 'entityResolver.ts', 'activityAdapter.ts',
  // Phase 1B
  'workflowService.ts', 'statusResolver.ts',
  // Phase 1C
  'taskStateManager.ts', 'workflowMigrationService.ts',
  // Phase 2A
  'BacklogView.tsx', 'epicService.ts', 'storyService.ts', 'moduleService.ts', 'backlogService.ts',
  // Phase 2B
  'sprintService.ts', 'SprintView.tsx', 'SprintPlanningPanel.tsx', 'DraggableWorkItem.tsx', 'DroppableSprintZone.tsx',
  // Phase 2C
  'DynamicBoard.tsx', 'WorkflowColumn.tsx', 'DroppableWorkflowColumn.tsx', 'workflowResolver.ts',
  // Phase 2D
  'timelineSimulationEngine.ts', 'dependencyService.ts', 'criticalPathEngine.ts', 'timelineBaselineService.ts',
  // Phase 3A
  'reportingEngine.ts', 'teamPulseService.ts', 'escalationEngine.ts',
  // Phase 3B
  'attendanceEngine.ts', 'leaveBalanceService.ts', 'EmployeeDashboard.tsx',
  // Phase 3C
  'financeLedgerService.ts', 'financialRiskEngine.ts', 'FinanceCommandCenter.tsx'
];

const requiredTables = [
  'entity_links', 'activity_events', 'uid_sequences', 'stories', 'project_modules',
  'workflow_templates', 'workflow_states',
  'sprint_snapshots',
  'board_preferences', 'workflow_transitions',
  'timeline_baselines',
  'report_snapshots',
  'clock_events', 'attendance_policies',
  'ledger_transactions', 'finance_categories'
];

let existingFiles = new Set();
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
    } else {
      existingFiles.add(file);
    }
  }
}
walk(srcDir);

const sqlContent = fs.existsSync(sqlFile) ? fs.readFileSync(sqlFile, 'utf8') : '';
let existingTables = new Set();

for (const table of requiredTables) {
  const regex = new RegExp(`CREATE TABLE (IF NOT EXISTS )?(public\\.)?${table}\\b`, 'i');
  if (regex.test(sqlContent)) {
    existingTables.add(table);
  }
}

const report = {
  files: {},
  tables: {}
};

for (const f of requiredFiles) {
  report.files[f] = existingFiles.has(f);
}
for (const t of requiredTables) {
  report.tables[t] = existingTables.has(t);
}

console.log(JSON.stringify(report, null, 2));
