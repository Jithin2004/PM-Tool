const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'frontend/.env' });

async function testInsert() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    db: { schema: 'public' },
    global: { headers: { 'Accept-Profile': 'public, auth' } }
  });
  
  const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'superadmin-e2e@example.com',
    password: 'Password123!'
  });
  
  if (signInError) return console.error('Login failed:', signInError);
  
  const { data: user } = await supabase.from('users').select('workspace_id').eq('id', authData.session.user.id).single();
  
  const { data, error } = await supabase.from('projects').insert({
    name: 'Test Project Profile',
    status: 'planning',
    workspace_id: user.workspace_id,
    created_by_id: authData.session.user.id
  });
  
  console.log('Insert Error:', error);
}

testInsert();
