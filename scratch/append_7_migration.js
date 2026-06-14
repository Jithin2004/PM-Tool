const fs = require('fs');
const path = require('path');

const installScriptPath = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/database/production/RESOLVE_PM_V1_3_INSTALL.sql');
const migrationPath = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/database/migrations/add_batch_7_production_readiness.sql');

const installContent = fs.readFileSync(installScriptPath, 'utf8');
const migrationContent = fs.readFileSync(migrationPath, 'utf8');

if (!installContent.includes('Batch 7 Production Readiness Closure')) {
    fs.appendFileSync(installScriptPath, '\n\n' + migrationContent);
    console.log('Appended Batch 7 migration to RESOLVE_PM_V1_3_INSTALL.sql');
} else {
    console.log('Batch 7 migration already appended.');
}
