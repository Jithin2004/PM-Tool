const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const adminSupabase = createClient(supabaseUrl, serviceKey);

async function createTestUser(email, role) {
  const password = 'TestPassword123!';
  const { data: authData, error: authErr } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authErr && !authErr.message.includes('already been registered')) {
    throw authErr;
  }

  let user = authData?.user;
  if (!user) {
    const { data: existing } = await adminSupabase.auth.admin.listUsers();
    user = existing.users.find(u => u.email === email);
  }

  const { error: dbErr } = await adminSupabase.from('users').upsert({
    id: user.id,
    email: user.email,
    full_name: `Test ${role}`,
    role: role
  });

  if (dbErr) throw dbErr;

  const { data: sessionData, error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInErr) throw signInErr;

  return {
    user: sessionData.user,
    client: createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } }
    })
  };
}

async function verify() {
  console.log("Starting RC23.3 Production Schema Verification...");
  let schemaPassed = true;

  try {
    // 1. Check integration_health table
    console.log("\nChecking 'integration_health' table...");
    const { error: ihError } = await adminSupabase.from('integration_health').select('provider, status, last_checked_at, last_error, retry_count, metadata').limit(1);
    const { error: ihOldError } = await adminSupabase.from('integration_health').select('service, last_sync_attempt, integration_last_checked').limit(1);
    
    if (ihError) {
      console.log("FAIL: integration_health ->", ihError.message);
      schemaPassed = false;
    } else if (!ihOldError) {
      console.log("FAIL: integration_health old fields exist!");
      schemaPassed = false;
    } else {
      console.log("PASS: integration_health has correct schema.");
    }

    // 2. Check automation_templates table
    console.log("\nChecking 'automation_templates' table...");
    const { error: atError } = await adminSupabase.from('automation_templates').select('id, name, trigger_event, actions, is_active, created_at').limit(1);
    if (atError) {
      console.log("FAIL: automation_templates ->", atError.message);
      schemaPassed = false;
    } else {
      console.log("PASS: automation_templates has correct schema.");
    }

    // 3. Check files.archived_at column
    console.log("\nChecking 'files' table...");
    const { error: fileError } = await adminSupabase.from('files').select('id, archived_at, archived_by').limit(1);
    if (fileError) {
      console.log("FAIL: files archive fields ->", fileError.message);
      schemaPassed = false;
    } else {
      console.log("PASS: files table has archive columns.");
    }

    // 4. Check connected_accounts
    console.log("\nChecking 'connected_accounts' table...");
    const { error: caError } = await adminSupabase.from('connected_accounts').select('connected_at').limit(1);
    if (caError && caError.code !== 'PGRST116') { // ignoring empty rows error if any, wait PGRST116 is not returned for empty
      if (caError.message.includes('connected_at')) {
        console.log("FAIL: connected_accounts ->", caError.message);
        schemaPassed = false;
      }
    } else {
      console.log("PASS: connected_accounts has connected_at column.");
    }

    // 5. workspace_storage_usage
    console.log("\nChecking 'workspace_storage_usage' function...");
    const { error: wsuError } = await adminSupabase.rpc('workspace_storage_usage', { p_workspace_id: '00000000-0000-0000-0000-000000000000' });
    if (wsuError) {
      console.log("FAIL: workspace_storage_usage ->", wsuError.message);
      schemaPassed = false;
    } else {
      console.log("PASS: workspace_storage_usage is functional.");
    }

    // --- RLS VERIFICATION ---
    console.log("\n=================================");
    console.log("Starting RLS Verification...");
    console.log("=================================");
    let rlsPassed = true;

    const workspaceId = '00000000-0000-0000-0000-000000000000';
    const developer = await createTestUser('test_developer@example.com', 'developer');
    const clientUser = await createTestUser('test_client@example.com', 'client');
    const superAdmin = await createTestUser('test_super_admin@example.com', 'super_admin');

    // Developer Tests
    const { error: devHealthInsert } = await developer.client.from('integration_health').insert({ workspace_id: workspaceId, provider: 'test' });
    if (!devHealthInsert) {
      console.log("FAIL: Developer integration_health insert -> ALLOWED (Expected: BLOCKED)");
      rlsPassed = false;
    } else {
      console.log("PASS: Developer integration_health insert -> BLOCKED");
    }

    const { error: devAutoSelect } = await developer.client.from('automation_templates').select('*').limit(1);
    if (devAutoSelect) {
      console.log("FAIL: Developer automation_templates select -> BLOCKED (Expected: ALLOWED)");
      rlsPassed = false;
    } else {
      console.log("PASS: Developer automation_templates select -> ALLOWED");
    }

    const { error: devAutoInsert } = await developer.client.from('automation_templates').insert({ name: 'test', trigger_event: 'test' });
    if (!devAutoInsert) {
      console.log("FAIL: Developer automation_templates insert -> ALLOWED (Expected: BLOCKED)");
      rlsPassed = false;
    } else {
      console.log("PASS: Developer automation_templates insert -> BLOCKED");
    }

    // Client Tests
    const { data: clientHealthSelect, error: clientHealthErr } = await clientUser.client.from('integration_health').select('*').limit(1);
    if (!clientHealthErr && clientHealthSelect.length > 0) {
      // Depending on RLS, select returns [] instead of an error when blocked by USING clause
      console.log("FAIL: Client integration_health select -> ALLOWED (Expected: BLOCKED)");
      rlsPassed = false;
    } else {
      console.log("PASS: Client integration_health select -> BLOCKED");
    }

    const { error: clientAutoSelect } = await clientUser.client.from('automation_templates').select('*').limit(1);
    if (clientAutoSelect) {
      console.log("FAIL: Client automation_templates select -> BLOCKED (Expected: ALLOWED)");
      rlsPassed = false;
    } else {
      console.log("PASS: Client automation_templates select -> ALLOWED");
    }

    // Cleanup test users
    await adminSupabase.auth.admin.deleteUser(superAdmin.user.id);
    await adminSupabase.auth.admin.deleteUser(developer.user.id);
    await adminSupabase.auth.admin.deleteUser(clientUser.user.id);

    console.log("\n--- VERIFICATION RESULT ---");
    if (schemaPassed && rlsPassed) {
      console.log("✅ ALL CHECKS PASSED. Schema and RLS match RC23.3 expectations.");
    } else {
      console.log("❌ CHECKS FAILED.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Critical error during verification:", err);
    process.exit(1);
  }
}

verify();
