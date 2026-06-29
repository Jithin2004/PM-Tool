import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './frontend/.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL as string, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY as string);
async function run() {
  const { data, error } = await supabase.from('users').select('*').limit(5);
  console.log('Users:', JSON.stringify(data, null, 2));
  if (error) console.log('Error:', error);
}
run();
