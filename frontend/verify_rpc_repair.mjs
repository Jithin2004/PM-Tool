import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import crypto from 'crypto';


const SUPABASE_URL = "https://ctizplvjglydyrjqaalx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0aXpwbHZqZ2x5ZHlyanFhYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjMxNzEsImV4cCI6MjA5Mzk5OTE3MX0.bxLE_GxWW6HyAsAjg7ZxPUdyewy7VViLCvA7JikLXPA";
const PRODUCT_KEY = "64B7-D0E3-812B-7A3F";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const email = `cert_user_${Date.now()}@example.com`;
const password = 'Password123!';
const workspaceName = 'Direct RPC Certification Workspace';
const workspaceId = crypto.randomUUID();

async function runDirectRPCCertification() {
  console.log(`[1] Initiating Supabase Signup for ${email}...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });

  if (signUpError) {
    console.error("Signup failed:", signUpError);
    return;
  }
  const userId = signUpData.user.id;
  console.log(`    User created: ${userId}`);

  console.log(`[2] Confirming email directly in database...`);
  const pgClient = new pg.Client({
      host: 'aws-1-ap-southeast-1.pooler.supabase.com',
      port: 5432,
      user: 'postgres.ctizplvjglydyrjqaalx',
      password: '@Z7t3mc8rtk#',
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
  });

  await pgClient.connect();
  await pgClient.query("UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = $1", [userId]);
  console.log(`    Email confirmed.`);

  console.log(`[4] Invoking public.onboard_workspace_transaction directly...`);
  try {
    await pgClient.query('BEGIN');
    await pgClient.query(`
      SELECT set_config('request.jwt.claim.sub', $1::text, true);
    `, [userId]);
    
    await pgClient.query(`
      SELECT public.onboard_workspace_transaction(
        $1::uuid, $2::text, $3::uuid, $4::text, $5::text, $6::text, $7::text, $8::int
      )
    `, [workspaceId, workspaceName, userId, email, 'Test User', PRODUCT_KEY, 'enterprise', 50]);
    await pgClient.query('COMMIT');
    console.log(`    RPC Executed Successfully!`);
  } catch (rpcErr) {
    console.error(`    RPC FAILED:`, rpcErr.message);
    await pgClient.end();
    return;
  }

  console.log(`[5] Verifying Database State...`);
  const wsRes = await pgClient.query("SELECT * FROM public.workspaces WHERE id = $1", [workspaceId]);
  const licRes = await pgClient.query("SELECT * FROM public.workspace_license WHERE workspace_id = $1", [workspaceId]);
  
  if (wsRes.rows.length > 0 && licRes.rows.length > 0) {
    console.log(`    Workspace found:`, wsRes.rows[0].name);
    console.log(`    License found:`, licRes.rows[0].license_type, 'Seats:', licRes.rows[0].allowed_users);
    console.log(`\n✅ E2E RPC CERTIFICATION PASSED`);
  } else {
    console.log(`\n❌ E2E RPC CERTIFICATION FAILED: Missing rows`);
  }

  await pgClient.end();
}

runDirectRPCCertification().catch(console.error);
