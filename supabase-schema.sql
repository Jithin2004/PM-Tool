-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id BIGINT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional: Disable Row Level Security (RLS) so the app works easily for testing
-- (In a real production app, you would enable RLS and add proper policies)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  leave_type TEXT,
  is_paid_half_day BOOLEAN DEFAULT false,
  UNIQUE(user_id, date)
);

-- Create salaries table
CREATE TABLE IF NOT EXISTS salaries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  base_salary NUMERIC NOT NULL DEFAULT 3000
);

-- Create change_logs table
CREATE TABLE IF NOT EXISTS change_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changes TEXT NOT NULL,
  reason TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL
);

-- Disable Row Level Security (RLS) for testing
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE salaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE change_logs DISABLE ROW LEVEL SECURITY;


-- Create tactical_tasks table
CREATE TABLE IF NOT EXISTS tactical_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  assigned_to TEXT,
  weight NUMERIC DEFAULT 1.0,
  due_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task_history_logs table
CREATE TABLE IF NOT EXISTS task_history_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  author_id TEXT,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  telemetry_snapshot JSONB NOT NULL
);

-- Disable Row Level Security (RLS) for testing
ALTER TABLE tactical_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_history_logs DISABLE ROW LEVEL SECURITY;


