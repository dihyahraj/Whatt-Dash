-- ============================================================
-- WHATT-DASH: Performance Migration
-- Stores last message directly on conversations table
-- No more expensive message queries for conversation list!
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add last message columns to conversations
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS last_message TEXT,
ADD COLUMN IF NOT EXISTS last_message_type TEXT DEFAULT 'text',
ADD COLUMN IF NOT EXISTS last_message_role TEXT,
ADD COLUMN IF NOT EXISTS last_message_time TIMESTAMPTZ;

-- 2. Populate from existing data (one-time backfill)
UPDATE conversations c SET
  last_message = m.content,
  last_message_type = m.message_type,
  last_message_role = m.role,
  last_message_time = m.created_at
FROM (
  SELECT DISTINCT ON (conversation_id)
    conversation_id, content, message_type, role, created_at
  FROM messages
  WHERE is_deleted = false
  ORDER BY conversation_id, created_at DESC
) m
WHERE c.id = m.conversation_id;

-- 3. Index for fast conversation list
CREATE INDEX IF NOT EXISTS idx_conversations_list
ON conversations(is_archived, is_pinned DESC, updated_at DESC);
