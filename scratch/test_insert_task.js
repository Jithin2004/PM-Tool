const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'frontend/.env' });

async function testInsertTask() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  
  const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'projectmanager-e2e@example.com',
    password: 'Password123!'
  });
  
  if (signInError) {
    console.error('Login failed:', signInError);
    return;
  }
  
  const { data: user } = await supabase.from('users').select('workspace_id').eq('id', authData.session.user.id).single();
  
  const { data, error } = await supabase.from('tasks').insert({
    name: 'Test Task',
    status: 'backlog',
    project_id: '00000000-0000-0000-0000-000000000000', // Fake ID
    workspace_id: user.workspace_id,
  });
  
  console.log('Task Insert Error:', error);
}

testInsertTask();
