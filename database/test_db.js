import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = 'c:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/frontend/.env';
const envContent = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Checking if task_assignment_history exists...");
  const { data: data1, error: error1 } = await supabase.from('task_assignment_history').select('*').limit(1);
  if (error1) {
    console.log("task_assignment_history does NOT exist or has error:", error1.message);
  } else {
    console.log("task_assignment_history exists! Row count/data:", data1);
  }

  console.log("Checking if task_suggestions exists...");
  const { data: data2, error: error2 } = await supabase.from('task_suggestions').select('*').limit(1);
  if (error2) {
    console.log("task_suggestions does NOT exist or has error:", error2.message);
  } else {
    console.log("task_suggestions exists! Row count/data:", data2);
  }

  console.log("Checking if task_collaborators exists...");
  const { data: datac, error: errorc } = await supabase.from('task_collaborators').select('*').limit(1);
  if (errorc) {
    console.log("task_collaborators does NOT exist or has error:", errorc.message);
  } else {
    console.log("task_collaborators exists! Row count/data:", datac);
  }

  console.log("Listing all public schema functions...");
  // Note: we can query the public tables, let's check if we can read information_schema or pg_catalog
  const { data: functions, error: errorFuncs } = await supabase.from('users').select('id').limit(1); // just a check
  
  // Let's use a standard query if possible, but since we don't have direct SQL, let's check if get_shared_project_data exists
  const { data: dataRpc, error: errorRpc } = await supabase.rpc('get_shared_project_data', { p_token: 'dummy' });
  console.log("get_shared_project_data RPC test error:", errorRpc?.message);
}

test();
