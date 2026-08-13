-- ============================================================
-- WHATT-DASH: Performance Migration V2
-- Indexes for the paginated conversation list + message pagination.
-- Safe to re-run. Run this in the Supabase SQL Editor.
-- ============================================================

-- 1. Message pagination / delta polling.
--    Every chat open runs: WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 50
--    (plus "< before" for scroll-up and "> after" for the delta poll).
--    The old setup had two SEPARATE indexes (conversation_id) and (created_at),
--    so Postgres had to sort every message of a chat on each open.
CREATE INDEX IF NOT EXISTS idx_messages_convo_created
  ON messages (conversation_id, created_at DESC);

-- 2. Reply-context lookups and status updates from the webhook
--    (WHERE whatsapp_msg_id = ...). Unique index already covers this on most
--    setups; kept for older databases where the column was added later.
CREATE INDEX IF NOT EXISTS idx_messages_wa_msg_id
  ON messages (whatsapp_msg_id);

-- 3. Sidebar list: WHERE is_archived = false ORDER BY is_pinned DESC, updated_at DESC
CREATE INDEX IF NOT EXISTS idx_conversations_active_list
  ON conversations (is_archived, is_pinned DESC, updated_at DESC);

-- 4. The "Unread" filter chip: WHERE is_archived = false AND unread_count > 0
CREATE INDEX IF NOT EXISTS idx_conversations_unread
  ON conversations (is_archived, unread_count)
  WHERE unread_count > 0;

-- 5. Archived drawer: WHERE is_archived = true ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS idx_conversations_archived_list
  ON conversations (is_archived, updated_at DESC);

-- 6. Webhook hot path: find-or-create conversation by phone.
--    `phone` is UNIQUE in the base schema, so this is usually redundant —
--    included for databases created before that constraint.
CREATE INDEX IF NOT EXISTS idx_conversations_phone
  ON conversations (phone);

-- 7. Label filtering joins conversation_labels from the label side.
--    The composite primary key (conversation_id, label_id) can't serve a
--    label_id-first lookup, so add the reverse index.
CREATE INDEX IF NOT EXISTS idx_conversation_labels_label
  ON conversation_labels (label_id);

-- 8. Server-side conversation search uses ILIKE '%term%' on these columns.
--    Trigram indexes make that indexable instead of a full table scan.
--    Skipped automatically if the extension can't be created.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS idx_conversations_name_trgm
    ON conversations USING gin (name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_conversations_phone_trgm
    ON conversations USING gin (phone gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_conversations_last_message_trgm
    ON conversations USING gin (last_message gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm unavailable — search will fall back to a scan (%)', SQLERRM;
END $$;

-- 9. Refresh planner statistics so the new indexes get used immediately.
ANALYZE conversations;
ANALYZE messages;
ANALYZE conversation_labels;
