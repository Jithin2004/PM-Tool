const { createClient } = require('@supabase/supabase-js');

// These environment variables will be validated in index.js on startup.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Shared Supabase client for authentication tasks.
// Requires SUPABASE_ANON_KEY to securely invoke auth APIs (like getUser).
const supabaseAnon = supabaseUrl && supabaseAnonKey 
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
    : null;

// Shared Supabase client for service-role administrative operations (e.g. provisioning).
// Operates with elevated privileges. Bypasses Row Level Security.
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
    : null;

module.exports = {
    supabaseAnon,
    supabaseAdmin
};
