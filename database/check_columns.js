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

async function check() {
  const { data, error } = await supabase.from('workspaces').select('*').limit(1);
  if (error) {
    console.error("Error fetching workspace:", error.message);
  } else if (data && data.length > 0) {
    console.log("Workspace row keys:", Object.keys(data[0]));
    console.log("Workspace row data:", data[0]);
  } else {
    console.log("No workspaces found.");
  }
}

check();
