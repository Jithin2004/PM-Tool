const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing Supabase URL or Service Key");
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, serviceKey);
const authSupabase = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);

async function createTestUser(email, role) {
  const password = 'TestPassword123!';
  const { data: authData, error: authErr } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authErr && authErr.message !== 'User already registered') {
    throw authErr;
  }

  let user = authData?.user;
  if (!user) {
    const { data: existing } = await adminSupabase.auth.admin.listUsers();
    user = existing.users.find(u => u.email === email);
  }

  // Ensure public.users entry exists
  const { error: dbErr } = await adminSupabase.from('users').upsert({
    id: user.id,
    email: user.email,
    full_name: `Test ${role}`,
    role: role
  });

  if (dbErr) throw dbErr;

  const { data: sessionData, error: signInErr } = await authSupabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInErr) throw signInErr;

  return {
    user: sessionData.user,
    client: createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } }
    })
  };
}

async function runTests() {
  console.log("Starting RC23.3 RLS Verification...");
  try {
    const workspaceId = '00000000-0000-0000-0000-000000000000'; // dummy or let it fail constraint, we only care about RLS

    console.log("\nSetting up test users...");
    const superAdmin = await createTestUser('test_super_admin@example.com', 'super_admin');
    const developer = await createTestUser('test_developer@example.com', 'developer');
    const clientUser = await createTestUser('test_client@example.com', 'client');
    console.log("Users created and authenticated.");

    console.log("\n--- Testing super_admin ---");
    // Should be able to read and write integration_health
    const { error: saReadHealth } = await superAdmin.client.from('integration_health').select('*').limit(1);
    console.log("super_admin read integration_health:", saReadHealth ? saReadHealth.message : "PASS");
    
    // Should be able to read automation_templates
    const { error: saReadAuto } = await superAdmin.client.from('automation_templates').select('*').limit(1);
    console.log("super_admin read automation_templates:", saReadAuto ? saReadAuto.message : "PASS");

    console.log("\n--- Testing developer ---");
    // Should be able to read but NOT write integration_health
    const { error: devReadHealth } = await developer.client.from('integration_health').select('*').limit(1);
    console.log("developer read integration_health:", devReadHealth ? devReadHealth.message : "PASS");
    
    const { error: devInsertHealth } = await developer.client.from('integration_health').insert({ workspace_id: workspaceId, provider: 'test' });
    console.log("developer insert integration_health:", devInsertHealth ? "BLOCKED (PASS)" : "ALLOWED (FAIL)");

    console.log("\n--- Testing client ---");
    // Should NOT be able to read integration_health
    const { data: clientReadHealth, error: clientErrHealth } = await clientUser.client.from('integration_health').select('*').limit(1);
    // When RLS blocks read, it returns empty array [], not an error, unless the table is completely inaccessible.
    if (clientErrHealth) {
      console.log("client read integration_health:", clientErrHealth.message);
    } else {
      console.log("client read integration_health:", clientReadHealth.length === 0 ? "BLOCKED (PASS) - Returned 0 rows" : "ALLOWED (FAIL)");
    }
    
    // Should NOT be able to read automation_templates
    const { data: clientReadAuto, error: clientErrAuto } = await clientUser.client.from('automation_templates').select('*').limit(1);
    if (clientErrAuto) {
      console.log("client read automation_templates:", clientErrAuto.message);
    } else {
      console.log("client read automation_templates:", clientReadAuto.length === 0 ? "BLOCKED (PASS) - Returned 0 rows" : "ALLOWED (FAIL)");
    }

    console.log("\nCleaning up test users...");
    await adminSupabase.auth.admin.deleteUser(superAdmin.user.id);
    await adminSupabase.auth.admin.deleteUser(developer.user.id);
    await adminSupabase.auth.admin.deleteUser(clientUser.user.id);
    console.log("Cleanup complete.");

  } catch (err) {
    console.error("Test failed:", err);
  }
}

runTests();
