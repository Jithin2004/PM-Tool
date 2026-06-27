import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ProvisionOperation = "invite_user" | "bulk_invite_users" | "accept_invitation";

interface UserPayload {
  email: string;
  role?: string;
  department?: string;
  full_name?: string;
  capabilities?: string[];
  designation?: string;
}

function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const frontendUrl = Deno.env.get('FRONTEND_URL');

    if (!supabaseUrl || !supabaseServiceKey || !frontendUrl) {
      throw new Error('Missing environment configuration');
    }

    const payload = await req.json();
    const { operation, source = 'manual' } = payload;

    if (!operation || !["invite_user", "bulk_invite_users", "accept_invitation"].includes(operation)) {
      return new Response(JSON.stringify({ error: "Invalid operation" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    async function verifyRequester() {
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Missing or invalid Authorization header');
      }
      const token = authHeader.replace('Bearer ', '');

      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) throw new Error('Invalid or expired token');

      const { data: requester, error: requesterError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (requesterError || !requester) throw new Error('Requester profile not found');

      const allowedRoles = ['super_admin', 'admin', 'hr', 'project_manager'];
      if (!allowedRoles.includes(requester.role)) {
        throw new Error('Insufficient permissions to provision users');
      }
      return requester;
    }

    async function processInvite(userData: UserPayload, requester: any, src: string) {
      let { email, role, department, full_name, capabilities, designation } = userData;
      email = email.trim().toLowerCase();
      const targetRole = role || 'developer';

      if (targetRole === 'super_admin' && requester.role !== 'super_admin') {
        throw new Error(`Cannot invite super_admin`);
      }

      const legacyRoles = ['owner', 'manager', 'member', 'external', 'pm'];
      if (legacyRoles.includes(targetRole)) {
        throw new Error(`Role '${targetRole}' is a legacy role and can no longer be provisioned.`);
      }

      const { data: existingUser } = await supabaseAdmin.from('users').select('id').eq('email', email).eq('workspace_id', requester.workspace_id).maybeSingle();
      if (existingUser) {
        throw new Error(`User ${email} already exists in this workspace`);
      }

      const inviteToken = generateToken();
      const inviteExpiresAt = new Date();
      inviteExpiresAt.setDate(inviteExpiresAt.getDate() + 7);

      const { error: dbError } = await supabaseAdmin.from('invitations').insert({
        workspace_id: requester.workspace_id,
        email: email,
        role: targetRole,
        token: inviteToken,
        status: 'pending',
        expires_at: inviteExpiresAt.toISOString(),
        created_by: requester.id
      });

      if (dbError) {
        if (dbError.code === '23505') {
            throw new Error(`An active invitation already exists for this email.`);
        }
        throw dbError;
      }

      return {
        email,
        invite_link: `${frontendUrl}/accept-invite/${inviteToken}`
      };
    }

    if (operation === 'invite_user') {
      const requester = await verifyRequester();
      const { email, role, department, full_name, capabilities, designation } = payload;
      
      if (!email) throw new Error('Email is required');

      const result = await processInvite({ email, role, department, full_name, capabilities, designation }, requester, source);
      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (operation === 'bulk_invite_users') {
      const requester = await verifyRequester();
      const { users } = payload;
      
      if (!Array.isArray(users) || users.length === 0) {
        throw new Error('Users array is required');
      }

      const results = [];
      const errors = [];

      for (const user of users) {
        try {
          const resData = await processInvite(user, requester, source);
          results.push(resData);
        } catch (e: any) {
          errors.push({ email: user.email, error: e.message });
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Processed ${users.length} invitations`, 
        results, 
        errors 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (operation === 'accept_invitation') {
      const { token, password } = payload;

      if (!token || !password) throw new Error('Token and password are required');
      if (password.length < 8) throw new Error('Password must be at least 8 characters');

      const { data: invRow, error: fetchError } = await supabaseAdmin
        .from('invitations')
        .select('id, workspace_id, email, role, expires_at, status')
        .eq('token', token)
        .single();

      if (fetchError || !invRow) throw new Error('Invalid or expired invitation token');
      if (invRow.status !== 'pending') throw new Error('This invitation has already been processed');
      if (new Date(invRow.expires_at) < new Date()) throw new Error('This invitation has expired');

      let authUserId = null;
      const { data: authUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: invRow.email,
        password: password,
        email_confirm: true,
      });

      if (createUserError) {
        if (createUserError.message.includes('already registered') || createUserError.message.includes('already exists')) {
          throw new Error('An account with this email already exists. Please log in and join the workspace from your dashboard.');
        } else {
            throw createUserError;
        }
      }
      
      authUserId = authUser.user.id;

      const { error: insertUserError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUserId,
          email: invRow.email,
          workspace_id: invRow.workspace_id,
          role: invRow.role,
          status: 'active',
          full_name: invRow.email.split('@')[0], 
        });

      if (insertUserError) {
          throw insertUserError;
      }

      const { error: updateDbError } = await supabaseAdmin
        .from('invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invRow.id);

      if (updateDbError) throw updateDbError;

      return new Response(JSON.stringify({ success: true, message: 'Invitation accepted successfully' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
