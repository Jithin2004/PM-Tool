import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function test() {
  console.log("Fetching all users...");
  let allUsers: any[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.log("Error:", error);
      break;
    }
    if (!data || !data.users || data.users.length === 0) break;
    allUsers.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  
  console.log("Total users fetched:", allUsers.length);
  const found = allUsers.find(u => u.email === 'demo.admin@resolvepm.app');
  if (found) {
    console.log("User FOUND:", found.id);
  } else {
    console.log("User NOT FOUND");
    // Try to create it and see exact error
    console.log("Attempting to create...");
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'demo.admin@resolvepm.app',
      password: 'Password123!',
      email_confirm: true,
      user_metadata: { full_name: 'Alice Admin' }
    });
    console.log("Create result:", error ? error.message : data?.user?.id);
  }
}
test();
