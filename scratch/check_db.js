const { Client } = require('pg');
const client = new Client({
  host: process.env.SUPABASE_DB_HOST || 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  user: process.env.SUPABASE_DB_USER || 'postgres.ctizplvjglydyrjqaalx',
  password: process.env.SUPABASE_DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  
  const q1 = 'SELECT n.nspname AS schema_name, p.proname AS function_name, pg_get_function_identity_arguments(p.oid) AS args, pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.proname ILIKE \'%current_workspace%\';';
  const res1 = await client.query(q1);
  console.log('--- FUNCTIONS ---');
  console.log(JSON.stringify(res1.rows, null, 2));

  const q2 = "SELECT policyname, qual, with_check FROM pg_policies WHERE tablename='projects';";
  const res2 = await client.query(q2);
  console.log('--- POLICIES ---');
  console.log(JSON.stringify(res2.rows, null, 2));

  await client.end();
}
run().catch(console.error);
