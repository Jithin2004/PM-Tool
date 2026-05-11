import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// DEBUG: Check this in your browser console (F12)
console.log("Supabase URL is:", supabaseUrl);
console.log("Supabase Key starts with:", supabaseAnonKey?.substring(0, 10));

if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey.includes('...')) {
  throw new Error("CRITICAL: Supabase credentials are missing or invalid! Make sure your .env file is set up with valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
