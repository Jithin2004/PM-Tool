import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim().replace(/\r/g, '').replace(/\"/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim().replace(/\r/g, '').replace(/\"/g, '');
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = fs.readFileSync('../database/MIGRATION_SPRINT_20_WORKSPACE_LIFECYCLE.sql', 'utf8');
  console.log('Applying Sprint 20 migration via exec_sql...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Error applying migration:', error.message);
    process.exit(1);
  } else {
    console.log('Migration applied successfully!');
    process.exit(0);
  }
}
run();
