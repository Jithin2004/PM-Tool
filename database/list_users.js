import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = 'c:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/.env';
const envContent = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Running exec_sql to query public.users...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: 'SELECT * FROM public.users' });
  if (error) {
    console.error("SQL Error:", error.message);
  } else {
    console.log("Users inside database:", JSON.stringify(data, null, 2));
  }
}

run();
