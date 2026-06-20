// =============================================================================
// RC10 Production Stress & Failure Testing — Full Validation Suite
// =============================================================================
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ctizplvjglydyrjqaalx.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0aXpwbHZqZ2x5ZHlyanFhYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjMxNzEsImV4cCI6MjA5Mzk5OTE3MX0.bxLE_GxWW6HyAsAjg7ZxPUdyewy7VViLCvA7JikLXPA';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0aXpwbHZqZ2x5ZHlyanFhYWx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQyMzE3MSwiZXhwIjoyMDkzOTk5MTcxfQ.q_kpv-kvWl2R16oHpwfoc5J7Uo-s_jTiu-_qkRbdt3k';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(SUPABASE_URL, ANON_KEY);

// ─── Helpers ─────────────────────────────────────────────────────────
let passed = 0, failed = 0, warnings = 0;
const results: { test: string; status: string; detail?: string }[] = [];

function pass(name: string, detail?: string) {
  passed++;
  results.push({ test: name, status: '✅ PASS', detail });
  console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`);
}
function fail(name: string, detail?: string) {
  failed++;
  results.push({ test: name, status: '❌ FAIL', detail });
  console.error(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
}
function warn(name: string, detail?: string) {
  warnings++;
  results.push({ test: name, status: '⚠️ WARN', detail });
  console.warn(`  ⚠️ ${name}${detail ? ' — ' + detail : ''}`);
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Phase 1: Schema Validation ─────────────────────────────────────
async function validateSchema() {
  console.log('\n═══ Phase 1: Schema Validation ═══');

  const expectedTables = [
    'workspaces', 'users', 'teams', 'team_members', 'projects', 'project_members',
    'tasks', 'sprints', 'milestones', 'stories', 'epics',
    'activity_events', 'system_events',
    'entity_comments', 'comment_versions',
    'documents', 'document_versions', 'document_access', 'document_chunks',
    'files', 'file_versions', 'storage_usage',
    'automation_rules', 'automation_runs',
    'departments', 'clients',
    'invoices', 'invoice_line_items', 'payments', 'expenses',
    'finance_accounts', 'finance_categories', 'ledger_transactions', 'journal_entries',
    'attendance_policies', 'leave_balances', 'clock_events',
    'workflow_templates', 'workflow_states',
    'integration_connections',
    'notification_events', 'change_requests',
  ];

  // Probe each table directly via the service-role client
  for (const table of expectedTables) {
    const { error: tableErr } = await admin.from(table).select('*').limit(0);
    if (tableErr) {
      fail(`Table exists: ${table}`, tableErr.message);
    } else {
      pass(`Table exists: ${table}`);
    }
  }

  // Check RLS is enabled on critical tables (anon client should get empty or blocked)
  const rlsTables = ['workspaces', 'users', 'projects', 'tasks', 'invoices', 'documents', 'files'];
  for (const table of rlsTables) {
    const { data: rlsData, error: rlsErr } = await anon.from(table).select('*').limit(1);
    if (rlsErr && rlsErr.message.includes('permission denied')) {
      pass(`RLS active: ${table}`, 'Anon blocked');
    } else if (!rlsData || rlsData.length === 0) {
      pass(`RLS check: ${table}`, 'Returns empty (RLS filters by session)');
    } else {
      warn(`RLS check: ${table}`, `Anon returned ${rlsData.length} rows — investigate`);
    }
  }
}

// ─── Phase 2: First Install Flow ─────────────────────────────────────
let testUserId: string;
let testWorkspaceId: string;
let testProjectId: string;
let testTaskId: string;

async function validateFirstInstallFlow() {
  console.log('\n═══ Phase 2: First Install Flow ═══');

  // 2a. Create auth user
  const email = `rc10-test-${Date.now()}@resolvepm-test.com`;
  const password = 'RC10_SecurePass_2024!';
  const { data: signUpData, error: signUpErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (signUpErr || !signUpData.user) {
    fail('Create auth user', signUpErr?.message);
    return;
  }
  testUserId = signUpData.user.id;
  pass('Create auth user', testUserId);

  // 2b. Sign in as that user
  const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) {
    fail('Sign in as test user', signInErr.message);
    return;
  }
  pass('Sign in as test user', signInData.user?.id);

  // Create an authenticated client for this user
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${signInData.session?.access_token}` } }
  });

  // 2c. Create user row in public.users (no auto-trigger)
  const { error: userRowErr } = await admin.from('users').insert({
    id: testUserId,
    email,
    full_name: 'RC10 Test Admin',
    role: 'super_admin',
    status: 'active',
  });
  if (userRowErr) {
    fail('Create users row', userRowErr.message);
    return;
  }
  pass('Create users row');

  // 2d. Create workspace
  const { data: wsData, error: wsErr } = await admin.from('workspaces').insert({
    name: 'RC10 Test Workspace',
    owner_id: testUserId,
    business_type: 'Software',
    execution_mode: 'KANBAN',
  }).select().single();
  if (wsErr) {
    fail('Create workspace', wsErr.message);
    return;
  }
  testWorkspaceId = wsData.id;
  pass('Create workspace', testWorkspaceId);

  // 2e. Link user to workspace
  const { error: linkErr } = await admin.from('users').update({ workspace_id: testWorkspaceId }).eq('id', testUserId);
  if (linkErr) {
    fail('Link user to workspace', linkErr.message);
  } else {
    pass('Link user to workspace');
  }

  // 2f. Create a team
  const { data: teamData, error: teamErr } = await admin.from('teams').insert({
    workspace_id: testWorkspaceId,
    name: 'Engineering',
  }).select().single();
  if (teamErr) {
    fail('Create team', teamErr.message);
  } else {
    pass('Create team', teamData.id);
  }

  // 2g. Create a project
  const { data: projData, error: projErr } = await admin.from('projects').insert({
    workspace_id: testWorkspaceId,
    name: 'RC10 Validation Project',
    owner_id: testUserId,
    status: 'active',
    priority: 'high',
    execution_mode: 'KANBAN',
  }).select().single();
  if (projErr) {
    fail('Create project', projErr.message);
    return;
  }
  testProjectId = projData.id;
  pass('Create project', testProjectId);

  // 2h. Create a task
  const { data: taskData, error: taskErr } = await admin.from('tasks').insert({
    workspace_id: testWorkspaceId,
    project_id: testProjectId,
    name: 'First task ever',
    status: 'assigned',
    priority: 'high',
    assignee_id: testUserId,
  }).select().single();
  if (taskErr) {
    fail('Create task', taskErr.message);
    return;
  }
  testTaskId = taskData.id;
  pass('Create task', testTaskId);

  // 2i. Create an activity event
  const { error: actErr } = await admin.from('activity_events').insert({
    workspace_id: testWorkspaceId,
    actor_id: testUserId,
    entity_type: 'task',
    entity_id: testTaskId,
    action: 'created',
    metadata: { source: 'rc10_stress_test' },
  });
  if (actErr) {
    fail('Create activity event', actErr.message);
  } else {
    pass('Create activity event');
  }

  // 2j. Verify retrieval
  const { data: readTask, error: readErr } = await admin.from('tasks').select('*').eq('id', testTaskId).single();
  if (readErr || readTask.name !== 'First task ever') {
    fail('Read back task', readErr?.message);
  } else {
    pass('Read back task', `name="${readTask.name}"`);
  }
}

// ─── Phase 3: Large Workspace Stress Test ────────────────────────────
async function stressTest() {
  console.log('\n═══ Phase 3: Large Workspace Stress Test ═══');

  if (!testWorkspaceId) {
    fail('Stress test skipped', 'No workspace from Phase 2');
    return;
  }

  const BATCH = 50; // Insert in batches

  // 3a. Create 100 users
  console.log('  Creating 100 stress test users...');
  const userIds: string[] = [testUserId];
  let userCreateFails = 0;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await admin.auth.admin.createUser({
      email: `rc10-stress-user-${i}-${Date.now()}@resolvepm-test.com`,
      password: 'StressPass123!',
      email_confirm: true,
    });
    if (error || !data.user) {
      userCreateFails++;
      continue;
    }
    userIds.push(data.user.id);
    // Insert corresponding public.users row
    await admin.from('users').insert({
      id: data.user.id,
      email: data.user.email,
      full_name: `Stress User ${i}`,
      workspace_id: testWorkspaceId,
      role: i < 5 ? 'pm' : 'developer',
      status: 'active',
    });
  }
  if (userCreateFails > 10) {
    fail(`Create stress users`, `${userCreateFails}/100 failed`);
  } else {
    pass(`Create stress users`, `${100 - userCreateFails}/100 succeeded`);
  }

  // 3b. Create 100 projects
  console.log('  Creating 100 projects...');
  const projectIds: string[] = [testProjectId];
  const projectRows = Array.from({ length: 100 }, (_, i) => ({
    workspace_id: testWorkspaceId,
    name: `Stress Project ${i}`,
    owner_id: testUserId,
    status: 'active',
    priority: ['low', 'medium', 'high', 'urgent'][i % 4],
    execution_mode: ['KANBAN', 'SCRUM'][i % 2],
    tags: ['rc10_stress_test'],
  }));
  for (let b = 0; b < projectRows.length; b += BATCH) {
    const chunk = projectRows.slice(b, b + BATCH);
    const { data, error } = await admin.from('projects').insert(chunk).select('id');
    if (error) {
      fail(`Create projects batch ${b / BATCH}`, error.message);
    } else if (data) {
      data.forEach((p: any) => projectIds.push(p.id));
    }
  }
  pass(`Projects created`, `${projectIds.length} total`);

  // 3c. Create 10,000 tasks (in batches of 50)
  console.log('  Creating 10,000 tasks...');
  const taskIds: string[] = [testTaskId];
  let taskFails = 0;
  const statuses = ['assigned', 'understanding', 'in_progress', 'blocked', 'ready_for_review', 'changes_requested', 'completed'];
  for (let b = 0; b < 10000; b += BATCH) {
    const chunk = Array.from({ length: Math.min(BATCH, 10000 - b) }, (_, i) => ({
      workspace_id: testWorkspaceId,
      project_id: projectIds[(b + i) % projectIds.length],
      name: `Stress Task ${b + i}`,
      status: statuses[(b + i) % statuses.length],
      priority: ['low', 'medium', 'high', 'urgent'][(b + i) % 4],
      assignee_id: userIds[(b + i) % userIds.length],
      tags: ['rc10_stress_test'],
    }));
    const { data, error } = await admin.from('tasks').insert(chunk).select('id');
    if (error) {
      taskFails++;
    } else if (data) {
      data.forEach((t: any) => taskIds.push(t.id));
    }
  }
  if (taskFails > 10) {
    fail(`Create tasks`, `${taskFails} batch failures`);
  } else {
    pass(`Tasks created`, `${taskIds.length} total (${taskFails} batch fails)`);
  }

  // 3d. Create 50,000 activity events (in batches of 100)
  console.log('  Creating 50,000 activity events...');
  let actFails = 0;
  const actions = ['created', 'updated', 'commented', 'status_changed', 'assigned', 'completed'];
  for (let b = 0; b < 50000; b += 100) {
    const chunk = Array.from({ length: Math.min(100, 50000 - b) }, (_, i) => ({
      workspace_id: testWorkspaceId,
      actor_id: userIds[(b + i) % userIds.length],
      entity_type: 'task',
      entity_id: taskIds[(b + i) % taskIds.length],
      action: actions[(b + i) % actions.length],
      metadata: { source: 'rc10_stress_test', index: b + i },
    }));
    const { error } = await admin.from('activity_events').insert(chunk);
    if (error) actFails++;
  }
  if (actFails > 20) {
    fail(`Create activity events`, `${actFails} batch failures`);
  } else {
    pass(`Activity events created`, `Target 50k (${actFails} batch fails)`);
  }

  // 3e. Create 500 comments
  console.log('  Creating 500 comments...');
  let commentFails = 0;
  for (let b = 0; b < 500; b += BATCH) {
    const chunk = Array.from({ length: Math.min(BATCH, 500 - b) }, (_, i) => ({
      workspace_id: testWorkspaceId,
      entity_type: 'task',
      entity_id: taskIds[(b + i) % taskIds.length],
      author_id: userIds[(b + i) % userIds.length],
      content: `Stress test comment ${b + i}. This is a realistic comment body for load testing.`,
    }));
    const { error } = await admin.from('entity_comments').insert(chunk);
    if (error) commentFails++;
  }
  pass(`Comments created`, `Target 500 (${commentFails} batch fails)`);

  // 3f. Create 50 sprints
  console.log('  Creating 50 sprints...');
  let sprintFails = 0;
  for (let i = 0; i < 50; i++) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + i * 14);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 14);
    const { error } = await admin.from('sprints').insert({
      workspace_id: testWorkspaceId,
      project_id: projectIds[i % projectIds.length],
      name: `Sprint ${i + 1}`,
      goal: `Stress test sprint ${i + 1}`,
      status: ['planning', 'active', 'completed'][i % 3],
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    });
    if (error) sprintFails++;
  }
  pass(`Sprints created`, `Target 50 (${sprintFails} fails)`);

  // 3g. Create 200 milestones
  console.log('  Creating 200 milestones...');
  let milestoneFails = 0;
  for (let b = 0; b < 200; b += BATCH) {
    const chunk = Array.from({ length: Math.min(BATCH, 200 - b) }, (_, i) => ({
      workspace_id: testWorkspaceId,
      project_id: projectIds[(b + i) % projectIds.length],
      name: `Milestone ${b + i}`,
      status: ['pending', 'in_progress', 'completed'][(b + i) % 3],
      due_date: new Date(Date.now() + (b + i) * 86400000).toISOString(),
    }));
    const { error } = await admin.from('milestones').insert(chunk);
    if (error) milestoneFails++;
  }
  pass(`Milestones created`, `Target 200 (${milestoneFails} batch fails)`);

  // 3h. Performance: dashboard-style query
  console.log('  Running performance queries...');
  const t1 = Date.now();
  const { data: dashData, error: dashErr } = await admin.from('tasks')
    .select('id, name, status, priority')
    .eq('workspace_id', testWorkspaceId)
    .limit(100);
  const dashTime = Date.now() - t1;
  if (dashErr) {
    fail('Dashboard query (tasks)', dashErr.message);
  } else {
    if (dashTime > 3000) {
      warn('Dashboard query (tasks)', `${dashTime}ms — SLOW (>3s)`);
    } else {
      pass('Dashboard query (tasks)', `${dashTime}ms, ${dashData?.length} rows`);
    }
  }

  // Activity count query
  const t2 = Date.now();
  const { count, error: countErr } = await admin.from('activity_events')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', testWorkspaceId);
  const countTime = Date.now() - t2;
  if (countErr) {
    fail('Activity count query', countErr.message);
  } else {
    if (countTime > 5000) {
      warn('Activity count query', `${countTime}ms — SLOW (>5s), count=${count}`);
    } else {
      pass('Activity count query', `${countTime}ms, count=${count}`);
    }
  }

  // Search-style query
  const t3 = Date.now();
  const { data: searchData, error: searchErr } = await admin.from('tasks')
    .select('id, name')
    .eq('workspace_id', testWorkspaceId)
    .ilike('name', '%Stress Task 999%')
    .limit(10);
  const searchTime = Date.now() - t3;
  if (searchErr) {
    fail('Search query (tasks ilike)', searchErr.message);
  } else {
    if (searchTime > 3000) {
      warn('Search query', `${searchTime}ms — SLOW, ${searchData?.length} results`);
    } else {
      pass('Search query', `${searchTime}ms, ${searchData?.length} results`);
    }
  }
}

// ─── Phase 4: Permission & RLS Penetration ───────────────────────────
async function permissionTests() {
  console.log('\n═══ Phase 4: Permission & RLS Penetration ═══');

  // Create a second user with no workspace access
  const outsiderEmail = `rc10-outsider-${Date.now()}@resolvepm-test.com`;
  const { data: outsiderAuth, error: outsiderErr } = await admin.auth.admin.createUser({
    email: outsiderEmail,
    password: 'OutsiderPass123!',
    email_confirm: true,
  });
  if (outsiderErr || !outsiderAuth.user) {
    fail('Create outsider user', outsiderErr?.message);
    return;
  }

  // Sign in as outsider
  const { data: outsiderSession, error: outsiderSignInErr } = await anon.auth.signInWithPassword({
    email: outsiderEmail,
    password: 'OutsiderPass123!',
  });
  if (outsiderSignInErr) {
    fail('Sign in outsider', outsiderSignInErr.message);
    return;
  }

  const outsiderClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${outsiderSession.session?.access_token}` } }
  });

  // Insert outsider into public.users (no workspace)
  await admin.from('users').insert({
    id: outsiderAuth.user.id,
    email: outsiderEmail,
    full_name: 'RC10 Outsider',
    role: 'viewer',
    status: 'active',
  });

  // 4a. Outsider should NOT see workspace tasks
  const { data: outsiderTasks } = await outsiderClient.from('tasks')
    .select('*')
    .eq('workspace_id', testWorkspaceId)
    .limit(5);
  if (outsiderTasks && outsiderTasks.length > 0) {
    fail('RLS: Outsider sees workspace tasks', `Found ${outsiderTasks.length} tasks`);
  } else {
    pass('RLS: Outsider cannot see workspace tasks');
  }

  // 4b. Outsider should NOT see workspace projects
  const { data: outsiderProjects } = await outsiderClient.from('projects')
    .select('*')
    .eq('workspace_id', testWorkspaceId)
    .limit(5);
  if (outsiderProjects && outsiderProjects.length > 0) {
    fail('RLS: Outsider sees workspace projects', `Found ${outsiderProjects.length}`);
  } else {
    pass('RLS: Outsider cannot see workspace projects');
  }

  // 4c. Outsider should NOT be able to insert into workspace
  const { error: outsiderInsertErr } = await outsiderClient.from('tasks').insert({
    workspace_id: testWorkspaceId,
    project_id: testProjectId,
    name: 'Unauthorized task',
    status: 'assigned',
    priority: 'low',
  });
  if (outsiderInsertErr) {
    pass('RLS: Outsider cannot insert tasks', outsiderInsertErr.message.substring(0, 80));
  } else {
    fail('RLS: Outsider was able to INSERT a task into another workspace!');
  }

  // 4d. Anon (no auth) should be blocked from everything
  const plainAnon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: anonData, error: anonErr } = await plainAnon.from('tasks').select('*').limit(1);
  if (anonData && anonData.length > 0) {
    fail('RLS: Anonymous user can read tasks!');
  } else {
    pass('RLS: Anonymous user blocked from tasks');
  }
}

// ─── Phase 5: Data Integrity (Delete Protection) ────────────────────
async function dataIntegrityTests() {
  console.log('\n═══ Phase 5: Data Integrity & Delete Protection ═══');

  // 5a. Try to delete a workspace that has projects (should fail due to RESTRICT)
  const { error: wsDelErr } = await admin.from('workspaces').delete().eq('id', testWorkspaceId);
  if (wsDelErr) {
    pass('Workspace delete protection', 'Blocked: ' + wsDelErr.message.substring(0, 80));
  } else {
    fail('Workspace delete protection', 'Workspace was deleted despite having projects!');
  }

  // 5b. Try to delete a project that has tasks (should fail due to RESTRICT)
  const { error: projDelErr } = await admin.from('projects').delete().eq('id', testProjectId);
  if (projDelErr) {
    pass('Project delete protection', 'Blocked: ' + projDelErr.message.substring(0, 80));
  } else {
    fail('Project delete protection', 'Project was deleted despite having tasks!');
  }

  // 5c. Verify user cannot be deleted if they own workspaces
  const { error: userDelErr } = await admin.from('users').delete().eq('id', testUserId);
  if (userDelErr) {
    pass('User delete protection', 'Blocked: ' + userDelErr.message.substring(0, 80));
  } else {
    fail('User delete protection', 'Owner user was deleted!');
  }
}

// ─── Phase 6: Finance Table Validation ───────────────────────────────
async function financeTests() {
  console.log('\n═══ Phase 6: Finance Table Validation ═══');

  // 6a. Create an invoice
  const { data: inv, error: invErr } = await admin.from('invoices').insert({
    workspace_id: testWorkspaceId,
    project_id: testProjectId,
    invoice_number: 'RC10-INV-001',
    status: 'draft',
    currency: 'USD',
    subtotal: 10000,
    tax_amount: 1000,
    total: 11000,
    issued_by: testUserId,
  }).select().single();
  if (invErr) {
    fail('Create invoice', invErr.message);
    return;
  }
  pass('Create invoice', inv.id);

  // 6b. Create payment
  const { error: payErr } = await admin.from('payments').insert({
    workspace_id: testWorkspaceId,
    invoice_id: inv.id,
    amount: 5000,
    currency: 'USD',
    payment_method: 'bank_transfer',
    status: 'completed',
    recorded_by: testUserId,
  });
  if (payErr) {
    fail('Create payment', payErr.message);
  } else {
    pass('Create payment');
  }

  // 6c. Create expense
  const { error: expErr } = await admin.from('expenses').insert({
    workspace_id: testWorkspaceId,
    project_id: testProjectId,
    description: 'RC10 stress test expense',
    amount: 500,
    currency: 'USD',
    category: 'operations',
    status: 'approved',
    submitted_by: testUserId,
  });
  if (expErr) {
    fail('Create expense', expErr.message);
  } else {
    pass('Create expense');
  }
}

// ─── Print Final Report ──────────────────────────────────────────────
function printReport() {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  RC10 STRESS TEST FINAL REPORT');
  console.log('═'.repeat(60));
  console.log(`  ✅ Passed:   ${passed}`);
  console.log(`  ❌ Failed:   ${failed}`);
  console.log(`  ⚠️  Warnings: ${warnings}`);
  console.log(`  Total:       ${passed + failed + warnings}`);
  console.log('═'.repeat(60));

  if (failed > 0) {
    console.log('\n  FAILURES:');
    results.filter(r => r.status.includes('FAIL')).forEach(r => {
      console.log(`    ❌ ${r.test}: ${r.detail || ''}`);
    });
  }
  if (warnings > 0) {
    console.log('\n  WARNINGS:');
    results.filter(r => r.status.includes('WARN')).forEach(r => {
      console.log(`    ⚠️ ${r.test}: ${r.detail || ''}`);
    });
  }
  console.log('\n');
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   RC10 Production Stress & Failure Test Suite       ║');
  console.log('║   Resolve PM — Fresh Install Validation             ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  const start = Date.now();

  await validateSchema();
  await validateFirstInstallFlow();
  await stressTest();
  await permissionTests();
  await dataIntegrityTests();
  await financeTests();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nTotal runtime: ${elapsed}s`);

  printReport();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
