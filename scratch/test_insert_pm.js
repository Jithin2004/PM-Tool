const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'frontend/.env' });

async function testInsert() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  
  const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'projectmanager-e2e@example.com',
    password: 'Password123!'
  });
  
  if (signInError) {
    console.error('Login failed:', signInError);
    return;
  }
  
  console.log('Logged in as', authData.session.user.id);
  
  const { data: user } = await supabase.from('users').select('workspace_id').eq('id', authData.session.user.id).single();
  console.log('Workspace ID:', user.workspace_id);
  
  const { data, error } = await supabase.from('projects').insert({
    name: 'Test Project PM',
    status: 'planning',
    workspace_id: user.workspace_id,
    created_by_id: authData.session.user.id
  });
  
  console.log('Insert Error:', error);
}

testInsert();
