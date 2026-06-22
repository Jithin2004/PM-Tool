import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';

// Load env vars from the frontend folder's .env file
dotenv.config();

// Ensure we have the environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
// STRICTLY enforce the non-Vite prefixed key for security
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ ERROR: Missing Supabase URL or Service Role Key.");
  console.error("Please provide VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (without VITE_ prefix) in your .env file.");
  process.exit(1);
}

// Initialize the Supabase client with the Service Role Key to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Lived-In Data Seeder
 * Rewritten to satisfy strict relational constraints and 4-Pillar hierarchy.
 */
async function seedDatabase() {
  console.log("🚀 Starting Resolve PM Data Seed...");

  try {
    // ==========================================
    // 1. USER CREATION (Auth)
    // ==========================================
    console.log("👑 Checking for existing Admin/Owner Auth Profile...");
    let adminId = '';
    const email = 'demo.admin@resolvepm.app';
    
    // 🔥 CRITICAL FIX: Clean up dangling public user to prevent trigger collision
    await supabase.from('users').delete().eq('email', email);
    
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    const existingUser = usersData?.users?.find((u: any) => u.email === email);
    
    if (existingUser) {
      console.log("✅ User already exists. Reusing ID...");
      adminId = existingUser.id;
    } else {
      console.log("👑 Creating new Admin/Owner Auth Profile...");
      const { data: adminAuth, error: adminError } = await supabase.auth.admin.createUser({
        email,
        password: 'Password123!',
        email_confirm: true,
        user_metadata: { full_name: 'Alice Admin' }
      });
      
      if (adminError || !adminAuth.user) {
        throw new Error(`Admin Auth Creation Failed: ${adminError?.message}`);
      }
      adminId = adminAuth.user.id;
    }

    // ==========================================
    // 2. PUBLIC USER RECORD
    // ==========================================
    console.log("👤 Creating Public User Record...");
    const { error: userError } = await supabase.from('users').upsert({
      id: adminId,
      email: email,
      full_name: 'Alice Admin'
    });
    if (userError) throw new Error(`User Upsert Failed: ${userError.message}`);

    // ==========================================
    // 3. WORKSPACE SEEDING
    // ==========================================
    const workspaceId = randomUUID();
    console.log("📦 Creating Sandbox Workspace...");
    const { data: workspace, error: wsError } = await supabase.from('workspaces').insert({
      id: workspaceId,
      owner_id: adminId,
      name: 'Resolve PM Demo Corp',
      status: 'sandbox', // Strictly required per SEEDING_GUIDELINES.md
      metadata: {
        environment: 'simulation',
        safe_to_purge: true,
        created_by: 'system'
      }
    }).select().single();
    if (wsError) throw new Error(`Workspace Creation Failed: ${wsError.message}`);
    console.log(`✅ Workspace created: ${workspace.name} (${workspace.id})`);

    // ==========================================
    // 4. TEAM CREATION (CRITICAL CONSTRAINT)
    // ==========================================
    const teamId = randomUUID();
    console.log("🤝 Creating Executive Board Team...");
    const { error: teamError } = await supabase.from('teams').insert({
      id: teamId,
      workspace_id: workspace.id,
      name: 'Executive Board',
      description: 'Core leadership and admin team'
    });
    if (teamError) throw new Error(`Team Creation Failed: ${teamError.message}`);

    // ==========================================
    // 5. TEAM MEMBER MAPPING
    // ==========================================
    console.log("👥 Linking Admin to Team and Workspace...");
    const { error: tmError } = await supabase.from('team_members').insert({
      user_id: adminId,
      workspace_id: workspace.id,
      team_id: teamId,
      role: 'admin'
    });
    if (tmError) throw new Error(`Team Member Mapping Failed: ${tmError.message}`);

    // ==========================================
    // 6. PROJECT CREATION
    // ==========================================
    console.log("📂 Creating Demo Project...");
    const { data: project, error: projError } = await supabase.from('projects').insert({
      workspace_id: workspace.id,
      owner_id: adminId,
      name: 'Q3 Master Product Launch',
      status: 'active',
      priority: 'high',
      execution_mode: 'KANBAN'
    }).select().single();
    if (projError) throw new Error(`Project Creation Failed: ${projError.message}`);
    console.log(`✅ Project created: ${project.name}`);

    // ==========================================
    // 7. TASK CREATION (CRITICAL CONSTRAINTS)
    // ==========================================
    console.log("📝 Generating Strict Demo Tasks...");
    
    // Constraint: must be exactly 'completed' or 'in_progress'
    const allowedStatuses = ['completed', 'in_progress'];
    let tasksInserted = 0;

    for (let i = 1; i <= 10; i++) {
      const status = allowedStatuses[i % 2]; // Alternate status safely
      
      const { error: taskError } = await supabase.from('tasks').insert({
        workspace_id: workspace.id, // Mandatory
        project_id: project.id,
        assignee_id: adminId,
        name: `Mission Critical Step ${i}`, // Must use 'name', not 'title'
        status: status, // Must be 'completed' or 'in_progress'
        priority: 'high',
        estimated_hours: 4
      });

      if (taskError) throw new Error(`Task Creation Failed at task ${i}: ${taskError.message}`);
      tasksInserted++;
    }
    console.log(`✅ Seeded ${tasksInserted} Tasks.`);

    console.log("🎉 Seed Script Completed Successfully!");
    console.log("-------------------------------------------------");
    console.log(`Sandbox Workspace ID: ${workspace.id}`);
    console.log(`Team ID: ${teamId}`);
    console.log(`Admin Login: demo.admin@resolvepm.app / Password123!`);
    console.log("-------------------------------------------------");

  } catch (error: any) {
    console.error("❌ SEEDING FAILED:", error.message);
    process.exit(1);
  }
}

seedDatabase();
