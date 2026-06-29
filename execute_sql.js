const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: 'frontend/.env' });

async function executeSQL() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL or SUPABASE_DB_URL not found in environment');
    process.exit(1);
  }

  const client = new Client({
    host: process.env.SUPABASE_DB_HOST,
    port: 5432,
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log('Connected to database.');

    const sqlPath = path.resolve('db_migration_bug4.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing db_migration_bug4.sql...');
    await client.query(sql);
    console.log('Migration executed successfully.');

    console.log('Reloading PostgREST schema cache...');
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('PostgREST schema cache reloaded.');
  } catch (err) {
    console.error('Error executing SQL:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

executeSQL();
