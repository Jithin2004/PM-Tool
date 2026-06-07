import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { workspace_id } = await req.json()
    if (!workspace_id) throw new Error('workspace_id is required')

    // 1. Verify caller via user's JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    // Fetch the public user record for this workspace to check capability
    const { data: member, error: memberError } = await userClient
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('workspace_id', workspace_id)
      .maybeSingle()

    if (memberError || !member) throw new Error('User does not belong to workspace')

    // Capability Authorization: Check 'manage_workspace'
    const { data: hasCap, error: capError } = await userClient.rpc('has_capability', {
      p_user_id: member.id,
      p_capability: 'manage_workspace'
    })

    if (capError || !hasCap) {
      throw new Error('Must have manage_workspace capability to cleanup workspace')
    }

    // 2. Init Service Role Client
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Verify it is a test workspace
    const { data: ws, error: wsError } = await serviceClient
      .from('workspaces')
      .select('is_test_workspace, name')
      .eq('id', workspace_id)
      .single()

    if (wsError || !ws) throw new Error('Workspace not found')
    if (ws.is_test_workspace !== true) {
      throw new Error('CRITICAL: Cannot delete a production workspace. is_test_workspace must be true.')
    }

    console.log(`User ${user.id} initiating cleanup for test workspace: ${workspace_id}`);

    // Find the user's primary workspace to write the audit log (so it survives the deletion)
    const { data: primaryMember } = await serviceClient
      .from('users')
      .select('workspace_id, id')
      .eq('auth_user_id', user.id)
      .neq('workspace_id', workspace_id)
      .limit(1)
      .maybeSingle()

    // 4. Execute RPC with service_role
    const { error: rpcError } = await serviceClient.rpc('cleanup_test_workspace', { p_workspace_id: workspace_id })
    if (rpcError) throw new Error(`RPC failed: ${rpcError.message}`)

    // 5. Add Audit Entry
    if (primaryMember) {
      await serviceClient.from('activity_logs').insert({
        workspace_id: primaryMember.workspace_id,
        actor_id: primaryMember.id,
        action: 'test_workspace_cleanup',
        metadata: {
          deleted_workspace_id: workspace_id,
          deleted_workspace_name: ws.name,
          actor_id: user.id,
          cleanup_reason: 'Synthetic stress test teardown',
          cleanup_method: 'edge_function_service_role',
          timestamp: new Date().toISOString()
        }
      })
    }

    console.log(`Successfully cleaned up test workspace: ${workspace_id}`);

    return new Response(
      JSON.stringify({ success: true, message: `Cleaned up test workspace ${ws.name}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error(`Error in cleanup-test-workspace:`, error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
