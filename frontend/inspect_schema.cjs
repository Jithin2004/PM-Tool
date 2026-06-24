const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing Supabase URL or Service Key");
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, serviceKey);

async function inspectSchema() {
  // Let's get the schema definition of integration_health, automation_templates, files, and connected_accounts
  
  // Actually, since I can't query pg_attribute directly via PostgREST, 
  // I'll just query a single row from each table and log its keys.
  
  async function getKeys(table) {
    const { data, error } = await adminSupabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Error querying ${table}:`, error.message);
      return [];
    }
    if (data && data.length > 0) {
      return Object.keys(data[0]);
    }
    // If empty, insert a dummy record and rollback? We can't rollback via REST.
    console.log(`Table ${table} is empty. Can't determine columns from empty row via REST.`);
    return [];
  }
  
  console.log("integration_health columns:", await getKeys('integration_health'));
  console.log("automation_templates columns:", await getKeys('automation_templates'));
  console.log("files columns:", await getKeys('files'));
  console.log("connected_accounts columns:", await getKeys('connected_accounts'));
  console.log("workspace_storage_usage function:", await adminSupabase.rpc('workspace_storage_usage', { p_workspace_id: '00000000-0000-0000-0000-000000000000' }));
}

inspectSchema();
