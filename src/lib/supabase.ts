/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// Fallback to credentials provided in v2 code if environment variables are missing
const DEFAULT_URL = 'https://ctizplvjglydyrjqaalx.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0aXpwbHZqZ2x5ZHlyanFhYWx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MjMxNzEsImV4cCI6MjA5Mzk5OTE3MX0.bxLE_GxWW6HyAsAjg7ZxPUdyewy7VViLCvA7JikLXPA';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? DEFAULT_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? DEFAULT_KEY;

console.log("Connecting to Supabase at:", supabaseUrl); // Debugging line

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Supabase environment variables missing. Using fallback credentials.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
