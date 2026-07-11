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
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%file%';
  `)
).then(res => { 
  console.log("FILE-RELATED TABLES IN DB:");
  console.log(res.rows);
  client.end(); 
}).catch(e => { 
  console.error("FAILED: ", e.message); 
  client.end(); 
});
