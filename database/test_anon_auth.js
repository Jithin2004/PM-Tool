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

async function testAnon() {
  console.log("Attempting anonymous sign in...");
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error("Anonymous Sign-in failed:", error.message);
  } else {
    console.log("Anonymous Sign-in success! User:", data.user?.id);
    console.log("Session:", JSON.stringify(data.session, null, 2));
  }
}

testAnon();
