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
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'workspace_files';
  `)
).then(res => { 
  console.log("workspace_files COLUMNS:");
  console.log(res.rows);
  client.end(); 
}).catch(e => { 
  console.error("FAILED: ", e.message); 
  client.end(); 
});
