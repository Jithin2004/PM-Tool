const { Client } = require('pg');
require('dotenv').config({ path: 'frontend/.env' });

async function checkFunction() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  const client = new Client({ connectionString });
  await client.connect();
  const res = await client.query(`
    SELECT p.proname AS function_name, pg_get_function_arguments(p.oid) AS arguments
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'seed_sandbox';
  `);
  console.log(res.rows);
  await client.end();
}
checkFunction();
