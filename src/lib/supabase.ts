import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://ctizplvjglydyrjqaalx.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0aXpwbHZqZ2x5ZHlyanFhYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjMxNzEsImV4cCI6MjA5Mzk5OTE3MX0.bxLE_GxWW6HyAsAjg7ZxPUdyewy7VViLCvA7JikLXPA'; // Your full key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_KEY;

// DEBUG: Check this in your browser console (F12)
console.log("Supabase URL is:", supabaseUrl);
console.log("Supabase Key starts with:", supabaseAnonKey?.substring(0, 10));

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("CRITICAL: Supabase credentials are missing!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
