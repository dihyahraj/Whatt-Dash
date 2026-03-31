-- ============================================================
-- WHATT-DASH: Auth Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- Allowed users table (admin manages who can access)
CREATE TABLE IF NOT EXISTS allowed_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Insert the first admin
INSERT INTO allowed_users (email, display_name, role)
VALUES ('bioshop.pk@gmail.com', 'Bio Shop Admin', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_allowed_users_email ON allowed_users(email);

-- RLS: Only authenticated users can read allowed_users
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own record
CREATE POLICY "Users can read own record" ON allowed_users
  FOR SELECT USING (auth.email() = email);

-- Allow admins to read all records  
CREATE POLICY "Admins can read all" ON allowed_users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM allowed_users WHERE email = auth.email() AND role = 'admin')
  );

-- Allow admins to insert/update/delete
CREATE POLICY "Admins can manage users" ON allowed_users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM allowed_users WHERE email = auth.email() AND role = 'admin')
  );
