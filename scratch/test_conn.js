const { Client } = require('pg');
require('dotenv').config({ path: 'frontend/.env' });

async function run() {
  const c = new Client({
    connectionString: process.env.VITE_SUPABASE_URL.replace('https://', 'postgres://postgres.cyfgbgvwqevrqdytkghr:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
  });
  // Note: we can't connect without the real password, which we don't have.
}
run();
