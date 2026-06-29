const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'frontend/.env' });

async function testRpc() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  
  // Sign in as superadmin to have access
  const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'superadmin-e2e@example.com',
    password: 'Password123!'
  });
  
  if (signInError) return console.error('Login failed:', signInError);
  
  const { data, error } = await supabase.rpc('seed_sandbox', {
    p_sandbox_id: '00000000-0000-0000-0000-000000000000',
    p_payload: { teams: [], projects: [] }
  });
  
  console.log('RPC Error:', error);
  console.log('RPC Data:', data);
}

testRpc();
