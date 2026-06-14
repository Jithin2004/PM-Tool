const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/backend/auth-admin/.env';
const envContent = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let serviceRoleKey = '';

envContent.split('\n').forEach(line => {
  if (line.startsWith('SUPABASE_URL=')) supabaseUrl = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) serviceRoleKey = line.split('=')[1].replace(/"/g, '').trim();
});

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function findAndDeleteUser() {
  const emailToFind = 'jithinunni816@gmail.com';
  
  console.log(`\n🔍 Searching for user: ${emailToFind} in Supabase Auth...`);
  
  // 1. Fetch users from Supabase Auth
  // (admin.listUsers usually gets first 50, but let's just search via pg if we had to, 
  // or we can use admin.listUsers since it's a test environment)
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  
  if (listError) {
    console.error('Failed to list users:', listError.message);
    return;
  }

  const targetUser = users.find(u => u.email === emailToFind);

  if (!targetUser) {
    console.log(`❌ No account found for ${emailToFind} in Supabase Auth!`);
    return;
  }

  console.log(`✅ Found account! User ID: ${targetUser.id}`);
  console.log(`Created at: ${new Date(targetUser.created_at).toLocaleString()}`);
  
  // 2. Delete the user
  console.log(`\n🗑️ Deleting user ${emailToFind}...`);
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUser.id);
  
  if (deleteError) {
    console.error('❌ Failed to delete user:', deleteError.message);
  } else {
    console.log(`✅ Successfully deleted ${emailToFind}! You can now test the invite flow fresh.`);
  }
}

findAndDeleteUser();
