import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseKey || !adminEmail || !adminPassword) {
  console.error("Missing required environment variables. Please provide VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, ADMIN_EMAIL, and ADMIN_PASSWORD.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function signup() {
  console.log(`Attempting to sign up ${adminEmail}...`);
  const { data, error } = await supabase.auth.signUp({
    email: adminEmail,
    password: adminPassword
  });
  
  if (error) {
    console.error("Signup error:", error.message);
  } else {
    console.log("Signup success! User ID:", data.user?.id);
    console.log("Session details:", JSON.stringify(data.session, null, 2));
  }
}

signup();
