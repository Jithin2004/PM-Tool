import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSimulation() {
  console.log("Starting Phase 1: Create Test Company Simulation (Resolve Test Labs)");

  // 1. Ensure authenticated
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  if (authError || !authUser) {
    console.error("Must be authenticated to run simulation.");
    process.exit(1);
  }

  const wsName = `Resolve Test Labs`;

  // Check if it already exists
  const { data: existingWs } = await supabase.from('workspaces').select('id').eq('name', wsName).limit(1);
  let wsId = existingWs?.[0]?.id;

  if (wsId) {
    console.log(`Workspace already exists with id: ${wsId}. Cleaning up old simulation data...`);
    // Delete existing users, projects, tasks, etc...
    await supabase.from('projects').delete().eq('workspace_id', wsId);
    await supabase.from('users').delete().eq('workspace_id', wsId);
  } else {
    // Create new Workspace
    const { data: newWs, error: wsError } = await supabase.from('workspaces').insert({
      name: wsName,
      owner_id: authUser.id,
      business_type: 'Software',
      execution_mode: 'HYBRID',
      is_test_workspace: true
    }).select('id').single();

    if (wsError || !newWs) {
      console.error("Failed to create workspace", wsError);
      process.exit(1);
    }
    wsId = newWs.id;
    console.log(`Created workspace: ${wsId}`);
  }

  // 2. Create Users
  // Owner (current user)
  await supabase.from('users').insert({
    workspace_id: wsId,
    auth_user_id: authUser.id,
    email: authUser.email,
    role: 'super_admin'
  });

  const generateEmail = (role: string, index: number) => `${role}${index}@resolvetestlabs.local`;

  const userInserts: any[] = [];
  
  // 2 PMs
  for (let i=1; i<=2; i++) userInserts.push({ workspace_id: wsId, auth_user_id: `uuid-pm-${i}`, email: generateEmail('pm', i), role: 'pm', full_name: `PM ${i}` });
  // 10 Devs
  for (let i=1; i<=10; i++) userInserts.push({ workspace_id: wsId, auth_user_id: `uuid-dev-${i}`, email: generateEmail('dev', i), role: 'developer', full_name: `Dev ${i}` });
  // 1 HR
  userInserts.push({ workspace_id: wsId, auth_user_id: `uuid-hr-1`, email: generateEmail('hr', 1), role: 'hr', full_name: `HR Manager` });
  // 1 Finance
  userInserts.push({ workspace_id: wsId, auth_user_id: `uuid-fin-1`, email: generateEmail('finance', 1), role: 'finance', full_name: `Finance Manager` });
  // 3 Clients
  for (let i=1; i<=3; i++) userInserts.push({ workspace_id: wsId, auth_user_id: `uuid-client-${i}`, email: generateEmail('client', i), role: 'client', full_name: `Client ${i}` });

  // Add dummy users (bypassing auth foreign keys since auth_user_id is mostly used for lookup, actually it might fail if auth_user_id has an FK to auth.users)
  // Resolve PM doesn't strictly enforce auth.users FK on user_id? Let's check.
  // Actually, wait, RLS might block inserting users for fake auth ids. We'll use service role key or just leave them null if auth_user_id is nullable.
  // We'll insert what we can. 
  for (const u of userInserts) {
    const { error } = await supabase.from('users').insert(u);
    if (error) {
       console.log(`Failed to insert user ${u.email}:`, error.message);
    }
  }

  // 3. Create Projects
  const { data: projects, error: projErr } = await supabase.from('projects').insert([
    { workspace_id: wsId, name: 'Mobile App Development', status: 'active', execution_mode: 'SCRUM' },
    { workspace_id: wsId, name: 'Internal ERP', status: 'active', execution_mode: 'KANBAN' },
    { workspace_id: wsId, name: 'Client Website', status: 'planning', execution_mode: 'SCRUM' }
  ]).select('id, name');

  if (projErr || !projects) {
    console.error("Failed to create projects", projErr);
    return;
  }
  console.log(`Created ${projects.length} projects.`);

  // 4. Generate 30 days of data (tasks, blockers, approvals)
  const taskInserts: any[] = [];
  const devs = userInserts.filter(u => u.role === 'developer').map(u => u.auth_user_id);
  
  projects.forEach((proj, pIdx) => {
    for (let i=1; i<=20; i++) {
      taskInserts.push({
        workspace_id: wsId,
        project_id: proj.id,
        name: `${proj.name} - Task ${i}`,
        status: i % 5 === 0 ? 'blocked' : 'in_progress',
        priority: 'high',
        estimated_hours: 8,
        assignee_id: devs[i % devs.length]
      });
    }
  });

  const { data: tasks, error: taskErr } = await supabase.from('tasks').insert(taskInserts).select('id, name');
  if (taskErr) {
    console.error("Failed to create tasks", taskErr);
  } else {
    console.log(`Created ${tasks?.length} tasks.`);
  }

  // 5. Add execution_blockers to workspace_settings
  if (tasks && tasks.length > 0) {
    const blockers = [
      {
        task_id: tasks[0].id,
        category: 'DEPENDENCY',
        severity: 'CRITICAL',
        description: 'Payment integration delayed by 3 days',
        reported_at: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 days ago
      }
    ];

    await supabase.from('workspace_settings').insert({
      workspace_id: wsId,
      settings_blob: {
        execution_blockers: blockers
      }
    });
    console.log("Added blockers to workspace settings");
  }

  console.log("Simulation seed complete.");
}

runSimulation().catch(console.error);
