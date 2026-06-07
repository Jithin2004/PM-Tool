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

async function signup() {
  const email = `admin_innovations_sprint9@outlook.com`;
  const password = 'Password123!';
  console.log(`Attempting to sign up ${email}...`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  if (error) {
    console.error("Signup error:", error.message);
  } else {
    console.log("Signup success! User ID:", data.user?.id);
    console.log("Session details:", JSON.stringify(data.session, null, 2));
  }
}
signup();
