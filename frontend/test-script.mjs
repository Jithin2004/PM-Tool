import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL.replace(/"/g, '');
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY.replace(/"/g, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking files table...");
  const res1 = await supabase.from('files').select('archived_at, archived_by').limit(1);
  console.log('files:', res1.error ? res1.error.message : 'OK');

  console.log("Checking workspace_storage_usage...");
  const res2 = await supabase.rpc('workspace_storage_usage', { p_workspace_id: '00000000-0000-0000-0000-000000000000' });
  console.log('workspace_storage_usage:', res2.error ? res2.error.message : 'OK', res2.data);

  console.log("Checking integration_health...");
  const res3 = await supabase.from('integration_health').select('provider, last_checked_at').limit(1);
  console.log('integration_health:', res3.error ? res3.error.message : 'OK');

  console.log("Checking automation_templates...");
  const res4 = await supabase.from('automation_templates').select('id, is_active, created_at').limit(1);
  console.log('automation_templates:', res4.error ? res4.error.message : 'OK');
}

run();
