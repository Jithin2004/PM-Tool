const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const ADMIN_DB_URL = process.env.ADMIN_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

async function validateCleanInstall() {
  console.log(`Starting Resolve PM RC5 Clean Install Validation...`);
  const dbName = `rc5_validation_${Date.now()}`;

  console.log(`[1/3] Creating ephemeral database: ${dbName}`);
  const rootClient = new Client({ connectionString: ADMIN_DB_URL });
  try {
    await rootClient.connect();
    await rootClient.query(`CREATE DATABASE ${dbName}`);
  } catch (err) {
    console.error(`Failed to create database. Is Postgres running and accessible at ADMIN_DATABASE_URL?`);
    console.error(err);
    process.exit(1);
  } finally {
    await rootClient.end();
  }

  const testDbUrl = ADMIN_DB_URL.replace(/\/[^/]+$/, `/${dbName}`);
  const client = new Client({ connectionString: testDbUrl });

  try {
    await client.connect();
    console.log(`[2/3] Executing canonical installer script...`);
    
    const sqlPath = path.join(__dirname, '../database/production/RESOLVE_PM_V1_3_INSTALL.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute all SQL
    await client.query(sqlContent);
    console.log(`Installer executed successfully.`);

    console.log(`[3/3] Verifying database state...`);

    // Verify V2 Tables exist
    const requiredTables = [
      'entity_links', 'activity_events', 'uid_sequences',
      'workflow_templates', 'workflow_states', 'workflow_transitions',
      'epics', 'stories', 'sprints', 'sprint_snapshots',
      'timeline_baselines', 'report_snapshots', 'report_templates',
      'clock_events', 'leave_balances', 'attendance_policies',
      'ledger_transactions', 'finance_accounts', 'integration_connections',
      'integration_events', 'integration_mappings', 'webhook_endpoints'
    ];

    const { rows: tables } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    const existingTables = new Set(tables.map(t => t.table_name));
    const missingTables = requiredTables.filter(t => !existingTables.has(t));

    if (missingTables.length > 0) {
      throw new Error(`Missing V2 Tables: ${missingTables.join(', ')}`);
    }
    console.log(`✅ All ${requiredTables.length} required V2 tables exist.`);

    // Verify RLS is enabled on all required tables
    const { rows: rlsStatus } = await client.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relnamespace = 'public'::regnamespace 
      AND relname = ANY($1)
    `, [requiredTables]);

    const disabledRls = rlsStatus.filter(r => !r.relrowsecurity);
    if (disabledRls.length > 0) {
      throw new Error(`RLS is DISABLED on: ${disabledRls.map(r => r.relname).join(', ')}`);
    }
    console.log(`✅ RLS is enabled on all core tables.`);

    // Check Policies count
    const { rows: policies } = await client.query(`
      SELECT tablename, COUNT(*) as policy_count
      FROM pg_policies
      WHERE schemaname = 'public'
      GROUP BY tablename
    `);
    
    console.log(`✅ Found ${policies.reduce((acc, p) => acc + parseInt(p.policy_count), 0)} Row Level Security policies.`);

    console.log(`\n🎉 RC5.2 DATABASE INSTALLER VALIDATION PASSED.`);
    
    // Cleanup
    console.log(`Dropping ephemeral database...`);
    await client.end();
    
    const cleanupClient = new Client({ connectionString: ADMIN_DB_URL });
    await cleanupClient.connect();
    await cleanupClient.query(`DROP DATABASE ${dbName}`);
    await cleanupClient.end();

  } catch (err) {
    console.error(`\n❌ VALIDATION FAILED:`);
    console.error(err);
    process.exit(1);
  }
}

validateCleanInstall();
