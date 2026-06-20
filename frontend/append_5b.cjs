const fs = require('fs');
const path = require('path');

const installSqlPath = path.join(__dirname, '../database/production/RESOLVE_PM_V1_3_INSTALL.sql');
const scratchPath = path.join(__dirname, 'scratch_phase5b_schema.sql');

const sqlText = fs.readFileSync(installSqlPath, 'utf8');
const appendText = fs.readFileSync(scratchPath, 'utf8');

if (!sqlText.includes('CREATE TABLE public.entity_comments')) {
    fs.writeFileSync(installSqlPath, sqlText + '\n\n' + appendText, 'utf8');
    console.log('Appended Phase 5A and 5B successfully.');
} else {
    console.log('Tables already exist, skipping append.');
}
