import { Client } from 'pg';
import * as fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  console.log('Connected to database.\n');

  // 1. Run Reset Script
  const resetPath = 'C:\\Users\\jithi\\.gemini\\antigravity-ide\\brain\\3625b073-e9c5-4d78-a2fd-ea6423617657\\RC10_RESET_DATABASE.sql';
  if (fs.existsSync(resetPath)) {
    console.log('Running RC10_RESET_DATABASE.sql...');
    const resetSql = fs.readFileSync(resetPath, 'utf8');
    try {
      await client.query(resetSql);
      console.log('✅ Reset completed.\n');
    } catch (err: any) {
      console.error('Reset error:', err.message);
      // Wait to see if we should proceed. Since it's drop if exists, it might be fine or fatal.
      // But let's fail fast if reset fails catastrophically
      if (!err.message.includes('does not exist')) {
        process.exit(1);
      }
    }
  }

  // 2. Run Full Install Script as a single execution string (ON_ERROR_STOP behavior)
  const installPath = 'C:\\Users\\jithi\\OneDrive\\Desktop\\Resolve PM\\Resolve PM\\database\\production\\RESOLVE_PM_V1_3_INSTALL.sql';
  console.log('Running RESOLVE_PM_V1_3_INSTALL.sql as a single block...');
  const installSql = fs.readFileSync(installPath, 'utf8');

  try {
    // client.query executes the entire string. If any statement fails, it aborts.
    await client.query(installSql);
    console.log('✅ Installation completed successfully without errors.\n');
  } catch (err: any) {
    console.error('❌ Installation failed!');
    console.error(err.message);
    if (err.position) {
      // Find the line number where it failed
      const pos = parseInt(err.position, 10);
      const snippetBefore = installSql.substring(0, pos);
      const lineNumber = snippetBefore.split('\n').length;
      console.error(`Error near line ${lineNumber}`);
    }
    process.exit(1);
  }

  // 3. Send schema reload notification
  try {
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('✅ Schema reload notification sent.');
  } catch {}

  await client.end();
  console.log('Disconnected.\n');
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
