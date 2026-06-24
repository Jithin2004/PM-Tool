const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing Supabase URL or Service Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkPolicies() {
  const { data, error } = await supabase.rpc('run_sql', { query: `
    SELECT tablename, policyname, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename IN ('integration_health', 'automation_templates', 'files');
  `});
  
  if (error) {
    // try direct query if run_sql doesn't exist
    const { data: qData, error: qError } = await supabase
      .from('pg_policies')
      .select('*')
      .in('tablename', ['integration_health', 'automation_templates', 'files']);
      
    if (qError) {
      console.error("Failed to fetch policies directly:", qError);
    } else {
      console.log("Policies:", JSON.stringify(qData, null, 2));
    }
  } else {
    console.log("Policies via RPC:", data);
  }
}

checkPolicies();
