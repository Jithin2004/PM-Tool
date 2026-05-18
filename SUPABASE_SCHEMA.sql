-- SETUP SCRIPT FOR RESOLVE PM
-- Copy this into your Supabase SQL Editor and run it.

-- 1. Create Profiles table (RBAC)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('super_admin', 'pm', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in-progress', 'review', 'deployed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  efficiency NUMERIC DEFAULT 1.0,
  pert_best NUMERIC NOT NULL,
  pert_likely NUMERIC NOT NULL,
  pert_worst NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  owner_id UUID REFERENCES auth.users(id),
  team_id UUID,
  tags TEXT[] DEFAULT '{}',
  proposed_start_date TIMESTAMPTZ,
  delete_reason TEXT,
  client_deadline TIMESTAMPTZ,
  real_hours NUMERIC
);

-- 3. Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Profiles
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile (role prevented by trigger/app logic)" 
ON profiles FOR UPDATE USING (auth.uid()::uuid = id);

CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT WITH CHECK (auth.uid()::uuid = id);

-- 5. Policies for Projects
CREATE POLICY "Projects viewable by authenticated users" 
ON projects FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and PMs can insert" 
ON projects FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid()::uuid 
    AND profiles.role IN ('super_admin', 'pm')
  )
);

CREATE POLICY "Admins and PMs can update" 
ON projects FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid()::uuid 
    AND profiles.role IN ('super_admin', 'pm')
  )
);

CREATE POLICY "Only Super Admins can delete" 
ON projects FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid()::uuid 
    AND profiles.role = 'super_admin'
  )
);

-- 6. Dedicated table for Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'half_day', 'absent')),
  leave_type TEXT CHECK (leave_type IN ('casual', 'medical', 'unexcused')),
  is_paid_half_day BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 7. Dedicated table for Salaries
CREATE TABLE IF NOT EXISTS salaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  base_salary NUMERIC NOT NULL DEFAULT 3000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Dedicated table for Change Logs (Audit Logs)
CREATE TABLE IF NOT EXISTS change_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  changes TEXT NOT NULL,
  reason TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL
);

-- 9. Enable RLS for new tables
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_logs ENABLE ROW LEVEL SECURITY;

-- 10. Security Policies for new tables
CREATE POLICY "Attendance viewable by authenticated users" 
ON attendance FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and PMs can modify attendance" 
ON attendance FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid()::uuid 
    AND profiles.role IN ('super_admin', 'pm')
  )
);

CREATE POLICY "Salaries viewable by authenticated users" 
ON salaries FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and PMs can modify salaries" 
ON salaries FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid()::uuid 
    AND profiles.role IN ('super_admin', 'pm')
  )
);

CREATE POLICY "Change logs viewable by authenticated users" 
ON change_logs FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and PMs can insert change logs" 
ON change_logs FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid()::uuid 
    AND profiles.role IN ('super_admin', 'pm')
  )
);

