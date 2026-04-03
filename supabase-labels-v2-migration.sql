-- ============================================================
-- WHATT-DASH: Labels V2 — Add creator tracking
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add created_by columns to labels table
ALTER TABLE labels 
  ADD COLUMN IF NOT EXISTS created_by_email TEXT,
  ADD COLUMN IF NOT EXISTS created_by_name TEXT,
  ADD COLUMN IF NOT EXISTS created_by_role TEXT DEFAULT 'admin';

-- Update existing labels to show they were created by admin
UPDATE labels 
SET created_by_email = 'bioshop.pk@gmail.com',
    created_by_name = 'Bio Shop Admin',
    created_by_role = 'admin'
WHERE created_by_email IS NULL;
