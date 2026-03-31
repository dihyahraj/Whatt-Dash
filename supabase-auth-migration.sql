-- ============================================================
-- WHATT-DASH: Auth Setup
-- Run ALL of this in Supabase SQL Editor
-- ============================================================

-- 1. Create allowed_users table
CREATE TABLE IF NOT EXISTS allowed_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- 2. Insert owner
INSERT INTO allowed_users (email, display_name, role)
VALUES ('bioshop.pk@gmail.com', 'Bio Shop Admin', 'admin')
ON CONFLICT (email) DO NOTHING;

-- 3. Disable RLS on allowed_users (simpler — API routes protect access)
ALTER TABLE allowed_users DISABLE ROW LEVEL SECURITY;

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_allowed_users_email ON allowed_users(email);
