// =============================================================================
// RC10 Install SQL Consolidation Script
// Fixes all known issues so RESOLVE_PM_V1_3_INSTALL.sql can run clean on empty DB
// =============================================================================
import * as fs from 'fs';

const sqlPath = 'C:\\Users\\jithi\\OneDrive\\Desktop\\Resolve PM\\Resolve PM\\database\\production\\RESOLVE_PM_V1_3_INSTALL.sql';
let sql = fs.readFileSync(sqlPath, 'utf8');

// First, fix the profile_id stuff
sql = sql.replace(
  /profile_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/g,
  'user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE'
);
sql = sql.replace(
  /profile_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE RESTRICT/g,
  'user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT'
);
sql = sql.replace(
  /CONSTRAINT unique_profile_workspace_employment UNIQUE \(profile_id, workspace_id\)/g,
  'CONSTRAINT unique_profile_workspace_employment UNIQUE (user_id, workspace_id)'
);
sql = sql.replace(/profile_id = auth\.uid\(\)/g, 'user_id = auth.uid()');
sql = sql.replace(
  /INSERT INTO public\.employment_records \(profile_id,/g,
  'INSERT INTO public.employment_records (user_id,'
);
sql = sql.replace(
  /ON CONFLICT \(profile_id, workspace_id\)/g,
  'ON CONFLICT (user_id, workspace_id)'
);

sql = sql.replace(
  /^\s*CREATE TABLE(?! IF NOT EXISTS)(\s+(?:[a-zA-Z0-9_]+\.)?[a-zA-Z_][a-zA-Z0-9_]*\s*\()/gmi,
  'CREATE TABLE IF NOT EXISTS$1'
);

sql = sql.replace(
  /^\s*CREATE INDEX(?! IF NOT EXISTS)(\s+)/gmi,
  'CREATE INDEX IF NOT EXISTS$1'
);
sql = sql.replace(
  /^\s*CREATE UNIQUE INDEX(?! IF NOT EXISTS)(\s+)/gmi,
  'CREATE UNIQUE INDEX IF NOT EXISTS$1'
);

sql = sql.replace(
  /DO \$\$\s*\nBEGIN\s*\n\s*IF EXISTS\(SELECT \* FROM information_schema\.columns WHERE table_name='employment_records' and column_name='profile_id'\) THEN\s*\n\s*ALTER TABLE employment_records RENAME COLUMN profile_id TO user_id;\s*\n\s*END IF;\s*\nEND \$\$;/g,
  '-- [RC10 FIX] profile_id → user_id rename removed (already consolidated)'
);

// Strip existing DROP POLICY IF EXISTS
sql = sql.replace(/^\s*DROP POLICY IF EXISTS\s+"[^"]+"\s+ON\s+\S+\s*;\s*\n/gmi, '');
sql = sql.replace(/^\s*DROP POLICY IF EXISTS\s+[a-zA-Z_][a-zA-Z0-9_]*\s+ON\s+\S+\s*;\s*\n/gmi, '');

// Now inject DROP POLICY IF EXISTS before every CREATE POLICY
sql = sql.replace(
  /^\s*CREATE POLICY\s+("?[^"\n]+"?)\s+ON\s+((?:[a-zA-Z0-9_]+\.)?[a-zA-Z0-9_]+)/gmi,
  (match, policyName, tableName) => {
    return `DROP POLICY IF EXISTS ${policyName} ON ${tableName};\nCREATE POLICY ${policyName} \nON ${tableName}`;
  }
);

// Strip existing DROP TRIGGER IF EXISTS
sql = sql.replace(/^\s*DROP TRIGGER IF EXISTS\s+\S+\s+ON\s+\S+\s*;\s*\n/gmi, '');

// Inject DROP TRIGGER IF EXISTS before every CREATE TRIGGER
// Look for CREATE TRIGGER name ... ON table
sql = sql.replace(
  /^\s*CREATE TRIGGER\s+([a-zA-Z0-9_]+)[\s\S]{1,100}?ON\s+((?:[a-zA-Z0-9_]+\.)?[a-zA-Z0-9_]+)/gmi,
  (match, triggerName, tableName) => {
    return `DROP TRIGGER IF EXISTS ${triggerName} ON ${tableName};\n${match.trim()}`;
  }
);

// Truncate policy names to 63 chars to avoid PSQL mismatch errors
sql = sql.replace(/^\s*CREATE POLICY\s+"([^"]+)"/gmi, (match, p1) => {
  if (p1.length > 63) {
    const shortened = p1.substring(0, 63);
    return `CREATE POLICY "${shortened}"`;
  }
  return match.trim();
});
sql = sql.replace(/^\s*DROP POLICY IF EXISTS\s+"([^"]+)"/gmi, (match, p1) => {
  if (p1.length > 63) {
    const shortened = p1.substring(0, 63);
    return `DROP POLICY IF EXISTS "${shortened}"`;
  }
  return match.trim();
});

fs.writeFileSync(sqlPath, sql, 'utf8');
console.log('Fixed file successfully.');
