const { Client } = require('pg');
const client = new Client({
  host: 'aws-1-ap-southeast-1.pooler.supabase.com', 
  port: 5432, 
  user: 'postgres.ctizplvjglydyrjqaalx', 
  password: '@Z7t3mc8rtk#', 
  database: 'postgres', 
  ssl: {rejectUnauthorized: false}
});
client.connect().then(() => 
  client.query(`
    -- Add UNIQUE constraint to workspace_id in workspace_license
    ALTER TABLE public.workspace_license 
    ADD CONSTRAINT workspace_license_workspace_id_key UNIQUE (workspace_id);
  `)
).then(() => { 
  console.log("SUCCESS: Added UNIQUE constraint to workspace_id"); 
  client.end(); 
}).catch(e => { 
  console.error("FAILED: ", e.message); 
  client.end(); 
});
