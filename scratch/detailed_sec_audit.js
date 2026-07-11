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
    SELECT 
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS signature,
      p.prosecdef AS is_secdef,
      p.proconfig AS proconfig,
      p.prosrc AS source_code
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef = true;
  `)
).then(res => { 
  const functions = res.rows.map(row => {
    const proconfig = row.proconfig || [];
    const searchPathConfig = proconfig.find(c => c.startsWith('search_path='));
    const isExplicit = !!searchPathConfig;
    const currentSearchPath = isExplicit ? searchPathConfig.split('=')[1] : null;

    // Check for pgcrypto / uuid-ossp extension functions in source code
    const extensionFuncs = ['gen_random_uuid', 'digest', 'crypt', 'decrypt', 'uuid_generate'];
    const referencesExtensions = extensionFuncs.some(f => row.source_code.includes(f));

    // Check for public table references (just rough text scan for table names)
    // Common tables: workspaces, users, teams, team_members, etc.
    const publicTables = [
      'workspaces', 'users', 'teams', 'team_members', 'departments', 
      'projects', 'tasks', 'comments', 'files', 'workspace_files', 
      'file_versions', 'workspace_license'
    ];
    const referencesPublicObjects = publicTables.some(t => row.source_code.includes(t));

    let risk = 'REVIEW';
    if (!isExplicit) {
      risk = 'INSECURE'; // Unset search_path is always insecure
    } else if (currentSearchPath === '""' || currentSearchPath === '""' || currentSearchPath === '') {
      risk = 'SAFE'; // Empty search path is secure
    } else if (currentSearchPath.includes('public')) {
      // It is review or insecure depending on qualifiers
      risk = 'REVIEW'; 
    }

    return {
      schema: row.schema_name,
      name: row.function_name,
      signature: row.signature,
      is_secdef: row.is_secdef ? 'yes' : 'no',
      current_search_path: currentSearchPath || 'UNSET',
      proconfig: row.proconfig ? row.proconfig.join(', ') : 'null',
      is_explicit: isExplicit ? 'yes' : 'no',
      references_extensions: referencesExtensions ? 'yes' : 'no',
      references_public_objects: referencesPublicObjects ? 'yes' : 'no',
      risk: risk
    };
  });

  console.log(JSON.stringify(functions, null, 2));
  client.end(); 
}).catch(e => { 
  console.error("FAILED: ", e.message); 
  client.end(); 
});
