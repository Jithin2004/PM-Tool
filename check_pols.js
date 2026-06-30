const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres.ctizplvjglydyrjqaalx:Y%2BqA%217%7B3B2m%26V5%24@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres' });
async function run() {
    await client.connect();
    const res = await client.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'workspace_onboarding_state'");
    console.log('RLS Enabled:', res.rows[0]?.relrowsecurity);
    const pols = await client.query("SELECT polname, polcmd FROM pg_policy WHERE polrelid = (SELECT oid FROM pg_class WHERE relname = 'workspace_onboarding_state')");
    console.log('Policies:', pols.rows);
    await client.end();
}
run().catch(console.error);
