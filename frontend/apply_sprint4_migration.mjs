import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  const cleanLine = line.replace('\r', '').trim();
  if (cleanLine.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = cleanLine.substring(cleanLine.indexOf('=')+1).trim().replace(/['"]/g, '');
  if (cleanLine.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = cleanLine.substring(cleanLine.indexOf('=')+1).trim().replace(/['"]/g, '');
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sqlFile = path.join(process.cwd(), '../database/MIGRATION_SPRINT4_EXTERNAL_ACCESS.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');
  
  console.log("Applying Sprint 4 Migration...");
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error("Failed to run via RPC. Error:", error.message);
  } else {
    console.log("Migration applied successfully via RPC.");
  }
}

run();
