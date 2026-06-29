const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'frontend/.env' });

async function testInsert() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  
  const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'superadmin-e2e@example.com',
    password: 'Password123!'
  });
  
  if (signInError) {
    console.error('Login failed:', signInError);
    return;
  }
  
  const { data: user } = await supabase.from('users').select('workspace_id').eq('id', authData.session.user.id).single();
  
  const { data, error } = await supabase.from('projects').insert({
    name: 'Test Project No User FK',
    status: 'planning',
    workspace_id: user.workspace_id
    // NO created_by_id!
  });
  
  console.log('Insert Error without created_by_id:', error);
}

testInsert();
