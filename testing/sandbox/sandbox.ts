import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './frontend/.env' });
import crypto from 'crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
import fs from 'fs';
import path from 'path';

export interface SandboxIdentity {
  email: string;
  role: string;
  session?: any;
}

export interface SandboxContext {
  sandboxId: string;
  workspaceId: string;
  identities: Record<string, SandboxIdentity>;
  provisionTimestamp: number;
}

export class SandboxIntegration {
  static async createSandbox() {
    console.log('Creating Sandbox Environment...');
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("SandboxProvisioningError: Missing Supabase credentials.");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const adminEmail = `superadmin-e2e@example.com`;
    const password = 'Password123!';
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: adminEmail,
      password: password
    });

    if (authError) {
      await supabase.auth.signInWithPassword({ email: adminEmail, password });
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const sourceUserId = sessionData.session?.user?.id;
    if (!sourceUserId) {
      throw new Error("SandboxProvisioningError: Failed to get admin user session.");
    }

    // CHECK FOR EXISTING SANDBOX TO BYPASS MIGRATION TRIGGERS
    const { data: existingUser } = await supabase.from('users').select('workspace_id').eq('id', sourceUserId).single();
    if (existingUser?.workspace_id) {
       console.log(`Reusing existing Sandbox ${existingUser.workspace_id}...`);
       return { sandboxId: existingUser.workspace_id };
    }
    
    const sourceWorkspaceId = crypto.randomUUID();

    await supabase.from('users').insert({
      id: sourceUserId,
      email: adminEmail,
      role: 'pending-workspace-setup',
      workspace_id: null
    });

    const { error: insertWsError } = await supabase.from('workspaces').insert({
      id: sourceWorkspaceId,
      name: 'Sandbox Template Workspace',
      created_by_id: sourceUserId
    });
    
    if (insertWsError) {
      throw new Error("SandboxProvisioningError: Failed to create template workspace: " + JSON.stringify(insertWsError));
    }

    const { data: sandboxId, error: cloneError } = await supabase.rpc('clone_workspace_to_sandbox', {
      p_workspace_id: sourceWorkspaceId,
      p_user_id: sourceUserId
    });

    if (cloneError || !sandboxId) {
      throw new Error("SandboxProvisioningError: clone_workspace_to_sandbox RPC failed: " + JSON.stringify(cloneError));
    }

    const { error: updateRoleError } = await supabase.from('users').update({
      workspace_id: sandboxId,
      role: 'super_admin',
      preferences: { tourCompleted: true }
    }).eq('id', sourceUserId);

    if (updateRoleError) {
      throw new Error("SandboxProvisioningError: Failed to elevate admin privileges: " + JSON.stringify(updateRoleError));
    }
    
    const { error: licenseError } = await supabase.from('workspace_license').insert({
      workspace_id: sandboxId,
      license_key_hash: 'sandbox_test_license_hash',
      activation_date: new Date().toISOString(),
      license_type: 'enterprise',
      support_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    });

    if (licenseError) {
      throw new Error("SandboxProvisioningError: Failed to provision license for sandbox: " + licenseError.message);
    }

    return { sandboxId };
  }

  static async provisionTestIdentities(sandboxId: string) {
    console.log(`Provisioning Test Identities for Sandbox ${sandboxId}...`);
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    
    const adminClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    await adminClient.auth.signInWithPassword({ email: `superadmin-e2e@example.com`, password: 'Password123!' });
    const { data: adminSession } = await adminClient.auth.getSession();
    const adminUserId = adminSession.session?.user?.id;

    const roles = ['Super Admin', 'Admin', 'Project Manager', 'Team Lead', 'Developer', 'QA', 'HR', 'Finance', 'Observer'];
    const identities: Record<string, SandboxIdentity> = {};
    const roleMapping: Record<string, string> = {
      'Super Admin': 'super_admin',
      'Admin': 'admin',
      'Project Manager': 'project_manager',
      'Team Lead': 'team_lead',
      'Developer': 'developer',
      'QA': 'employee',
      'HR': 'hr',
      'Finance': 'finance',
      'Observer': 'client'
    };
    
    for (const role of roles) {
      const email = `${role.replace(/\s+/g, '').toLowerCase()}-e2e@example.com`;
      const password = 'Password123!';
      const dbRole = roleMapping[role] || 'developer';

      if (role === 'Super Admin') {
        identities[role] = { email, role: 'super_admin', session: adminSession.session };
        continue;
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role, sandbox_id: sandboxId } }
      });
      
      if (authError) {
        await supabase.auth.signInWithPassword({ email, password });
      }
      
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      
      if (userId) {
         identities[role] = { email, role: dbRole, session: sessionData.session };
         // Check if user already provisioned to bypass update constraints
         const { data: existingUser } = await supabase.from('users').select('workspace_id').eq('id', userId).single();
         let isNewProvision = false;
         if (existingUser?.workspace_id !== sandboxId) {
           isNewProvision = true;
         } else {
           console.log(`[Sandbox Auth] ${email} already provisioned. Updating metadata...`);
         }

         if (isNewProvision && adminUserId) {
            const { error: invError } = await adminClient.from('invitations').insert({
              workspace_id: sandboxId,
              email: email,
              role: dbRole,
              created_by: adminUserId,
              token: crypto.randomUUID(),
              status: 'pending',
              expires_at: new Date(Date.now() + 86400000).toISOString()
            });
            if (invError && invError.code !== '23505') {
              throw new Error(`Failed to insert invitation for ${email}: ${invError.message}`);
            }
         }

         const { error: dbError } = await supabase.from('users').upsert({
           id: userId,
           email,
           workspace_id: sandboxId,
           role: dbRole,
           full_name: `${role} User`,
           availability_factor: 1,
           preferences: { tourCompleted: true }
         }, { onConflict: 'id' });
         
         if (dbError) {
           const { data: verifyUser } = await supabase.from('users').select('workspace_id').eq('id', userId).single();
           if (verifyUser?.workspace_id === sandboxId) {
             console.log(`[Sandbox Auth] Provisioned ${email} successfully in parallel.`);
           } else {
             throw new Error(`SandboxProvisioningError: Failed to provision public user ${email}: ${dbError.message}`);
           }
         } else {
           console.log(`[Sandbox Auth] Provisioned ${email} successfully in public.users.`);
         }
      }
    }
    return identities;
  }

  static async seedSandbox(sandboxId: string, data: any) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Sign in as superadmin to bypass RLS
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: 'superadmin-e2e@example.com',
      password: 'Password123!'
    });
    if (signInError) {
      console.warn(`[Sandbox] Seed sign-in failed: ${signInError.message}`);
      return;
    }

    try {
      const payload = data as import('../factories/dataFactory').SeedPayload;
      if (!payload?.teams || !payload?.projects) {
        console.warn('[Sandbox] Seed payload missing teams or projects — skipping.');
        return;
      }

      // ── Idempotent cleanup handled entirely by seed_sandbox RPC ──
      const { error: seedError } = await supabase.rpc('seed_sandbox', {
        p_sandbox_id: sandboxId,
        p_payload: payload
      });

      if (seedError) {
        throw new Error(`RPC seed_sandbox failed: ${seedError.message}`);
      }

      console.log(`[Sandbox] Successfully provisioned seed dataset via RPC.`);
    } catch (e: any) {
      console.warn(`[Sandbox] Seeding error: ${e.message}`);
    }
  }


  static async destroySandbox(sandboxId: string) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    try {
      // Due to prevent_user_hard_delete trigger, delete_sandbox_workspace will fail.
      // We skip actual destruction since tests now use Singleton sandbox logic.
    } catch (e: any) {
      console.warn(`[Sandbox] Error destroying sandbox ${sandboxId}:`, e.message);
    }
  }

  static getTestIdentity(role: string): string {
    return `${role.replace(/\s+/g, '').toLowerCase()}-e2e@example.com`;
  }

  static getSharedContext(): SandboxContext {
    const ctxPath = path.join(__dirname, 'context.json');
    if (!fs.existsSync(ctxPath)) {
      throw new Error("SandboxContext not found. Ensure runner.ts provisions the sandbox before tests run.");
    }
    return JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
  }
}
