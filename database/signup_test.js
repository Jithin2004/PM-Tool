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
  const email = `admin_demo@gmail.com`;
  const password = 'Password123!';

  console.log("Attempting signin first...");
  const signInRes = await supabase.auth.signInWithPassword({ email, password });
  if (signInRes.error) {
    console.log("Signin failed:", signInRes.error.message);
    
    console.log("Attempting signup...");
    const signUpRes = await supabase.auth.signUp({ email, password });
    if (signUpRes.error) {
      console.log("Signup failed:", signUpRes.error.message);
    } else {
      console.log("Signup success:", signUpRes.data);
    }
  } else {
    console.log("Signin success:", signInRes.data);
  }
}

run();
