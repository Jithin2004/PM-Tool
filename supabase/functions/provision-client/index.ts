import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// SEC-04 hardening: callers must present a valid user JWT.
// The service-role client is only used AFTER the caller is verified as an
// admin or owner of the target workspace.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ROLES = new Set(['admin', 'owner']);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ── 1. Authenticate the caller ─────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }
  const callerToken = authHeader.replace('Bearer ', '').trim();

  // Use an anon client scoped to the caller's JWT to verify identity
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${callerToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user: callerUser }, error: userError } = await callerClient.auth.getUser();
  if (userError || !callerUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized: invalid token' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  try {
    const { email, password, workspace_id } = await req.json();

    if (!email || !password || !workspace_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // ── 2. Authorize: caller must be admin/owner of the target workspace ──────
    const { data: callerProfile, error: profileError } = await callerClient
      .from('users')
      .select('role, workspace_id')
      .eq('id', callerUser.id)
      .eq('workspace_id', workspace_id)
      .maybeSingle();

    if (profileError || !callerProfile) {
      return new Response(JSON.stringify({ error: 'Forbidden: caller is not a member of this workspace' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    if (!ALLOWED_ROLES.has(callerProfile.role)) {
      return new Response(JSON.stringify({ error: `Forbidden: role '${callerProfile.role}' cannot provision users` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // ── 3. Use service-role client ONLY after authorization is confirmed ──────
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 4. Create the Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'client' }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed, no user returned.');

    const userId = authData.user.id;

    // 5. Map the Auth User to the public.users table as a Client in the specified Workspace
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: userId,
      email: email,
      workspace_id: workspace_id,
      role: 'client',
      status: 'active'
    });

    if (dbError) {
      // Rollback auth user if public table insert fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw dbError;
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Provisioning Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

