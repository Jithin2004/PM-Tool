import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './frontend/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL as string, process.env.VITE_SUPABASE_ANON_KEY as string);

async function run() {
  const { data, error } = await supabase.rpc('delete_sandbox_workspace', { p_workspace_id: 'edd74cc3-a21b-4bac-9a33-a304662c7ac2' });
  console.log('delete_sandbox_workspace result:', data, error);
}
run();
