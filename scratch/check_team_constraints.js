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
  client.query("SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.team_members'::regclass;")
).then(res => { 
  console.log(res.rows); 
  client.end(); 
}).catch(e => { 
  console.error(e); 
  client.end(); 
});
