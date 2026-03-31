-- ============================================================
-- WHATT-DASH: Enhanced Schema Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add new columns to conversations
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS profile_pic_url TEXT,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- 2. Add new columns to messages
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_mime_type TEXT,
ADD COLUMN IF NOT EXISTS media_filename TEXT,
ADD COLUMN IF NOT EXISTS media_caption TEXT,
ADD COLUMN IF NOT EXISTS media_sha256 TEXT,
ADD COLUMN IF NOT EXISTS reply_to_id TEXT,
ADD COLUMN IF NOT EXISTS reaction TEXT,
ADD COLUMN IF NOT EXISTS reaction_msg_id TEXT,
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS location_name TEXT,
ADD COLUMN IF NOT EXISTS location_address TEXT,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent'; -- sent, delivered, read, failed

-- 3. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_is_pinned ON conversations(is_pinned);
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_msg_id ON messages(whatsapp_msg_id);

-- 4. Enable Realtime for both tables (if not already)
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 5. RLS policies (adjust as needed)
-- Make sure RLS is enabled and you have appropriate policies
-- Or disable RLS for server-side access with service role key
