const { Client } = require('pg');

async function run() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No connection string');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Check if current_workspace exists and in which schema
    const res = await client.query(`
      SELECT routine_name, specific_schema 
      FROM information_schema.routines 
      WHERE routine_name = 'current_workspace'
    `);
    console.log('Functions:', res.rows);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
