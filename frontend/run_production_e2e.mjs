import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import crypto from 'crypto';

const SUPABASE_URL = "https://ctizplvjglydyrjqaalx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0aXpwbHZqZ2x5ZHlyanFhYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjMxNzEsImV4cCI6MjA5Mzk5OTE3MX0.bxLE_GxWW6HyAsAjg7ZxPUdyewy7VViLCvA7JikLXPA";
const BACKEND_URL = "https://pm-tool-server.onrender.com";
const PRODUCT_KEY = "64B7-D0E3-812B-7A3F";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const email = `cert_user_${Date.now()}@example.com`;
const password = 'Password123!';

async function runCertification() {
  console.log(`[1] Initiating Supabase Signup for ${email}...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError) {
    console.error("Signup failed:", signUpError);
    return;
  }

  console.log(`[2] Confirming email directly in database...`);
  const client = new pg.Client({
      host: 'aws-1-ap-southeast-1.pooler.supabase.com',
      port: 5432,
      user: 'postgres.ctizplvjglydyrjqaalx',
      password: '@Z7t3mc8rtk#',
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  await client.query("UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = $1", [email]);
  await client.end();
  console.log(`[3] Email confirmed.`);

  console.log(`[4] Signing in to retrieve JWT...`);
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error("Signin failed:", signInError);
    return;
  }

  const jwt = signInData.session.access_token;
  const correlationId = `cert-trace-${crypto.randomUUID()}`;

  console.log(`[5] Executing Backend Onboarding RPC wrapper...`);
  console.log(`    Correlation ID: ${correlationId}`);
  
  const onboardRes = await fetch(`${BACKEND_URL}/onboard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
      'X-Correlation-ID': correlationId
    },
    body: JSON.stringify({
      productKey: PRODUCT_KEY,
      workspaceName: "Certification Final Workspace"
    })
  });

  const responseText = await onboardRes.text();
  console.log(`[6] Backend Response: ${onboardRes.status}`);
  console.log(responseText);

  if (onboardRes.ok) {
    console.log(`\n✅ E2E CERTIFICATION PASSED`);
  } else {
    console.log(`\n❌ E2E CERTIFICATION FAILED`);
  }
}

runCertification().catch(console.error);
