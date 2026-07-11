const fs = require('fs');
const { Client } = require('pg');

const client = new Client({
  host: 'aws-1-ap-southeast-1.pooler.supabase.com', 
  port: 5432, 
  user: 'postgres.ctizplvjglydyrjqaalx', 
  password: '@Z7t3mc8rtk#', 
  database: 'postgres', 
  ssl: {rejectUnauthorized: false}
});

const sqlContent = fs.readFileSync('c:\\Users\\jithi\\OneDrive\\Desktop\\Resolve PM\\Resolve PM\\database\\production\\RESOLVE_PM_V1_3_INSTALL.sql', 'utf8');

const startIndex = sqlContent.indexOf('CREATE OR REPLACE FUNCTION public.onboard_workspace_transaction');
const endIndex = sqlContent.indexOf('$$;', startIndex) + 3;

if (startIndex === -1 || endIndex === 2) {
  console.error("Could not find function definition.");
  process.exit(1);
}

const functionSql = sqlContent.substring(startIndex, endIndex);

console.log("Applying the following SQL to production:");
console.log(functionSql.substring(0, 500) + "\n...\n" + functionSql.substring(functionSql.length - 200));

client.connect().then(() => 
  client.query(functionSql)
).then(() => { 
  console.log("SUCCESS: Re-deployed onboard_workspace_transaction"); 
  client.end(); 
}).catch(e => { 
  console.error("FAILED: ", e.message); 
  client.end(); 
});
