import fs from 'fs';

const content = fs.readFileSync('run_commands_log.txt', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('MIGRATION_SPRINT_20_WORKSPACE_LIFECYCLE.sql')) {
    console.log(`Line ${idx + 1}: ${line}`);
  }
});
