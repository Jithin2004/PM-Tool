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
  client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'team_members';")
).then(res => { 
  console.log(res.rows); 
  client.end(); 
}).catch(e => { 
  console.error(e); 
  client.end(); 
});
