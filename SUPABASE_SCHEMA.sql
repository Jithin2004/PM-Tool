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
  tags TEXT[] DEFAULT '{}'
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
