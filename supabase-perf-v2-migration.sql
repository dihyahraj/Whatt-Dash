-- ============================================================
-- WHATT-DASH: Performance Migration V2
--
-- Indexes + constraints for the paginated conversation list, keyset message
-- paging and a race-free unread counter. Safe to re-run.
-- Run this in the Supabase SQL Editor.
--
-- Index shapes here follow the query shapes in src/app/api/**; if you change a
-- query's ORDER BY, revisit the matching index or Postgres goes back to sorting
-- the whole matching set on every request.
-- ============================================================

-- ------------------------------------------------------------
-- 1. NOT NULL on the sort/filter columns.
--    A NULL in a DESC index sorts FIRST, which would float a row with a NULL
--    is_pinned above genuinely pinned chats — and keyset pagination on a
--    nullable column silently drops rows.
-- ------------------------------------------------------------
UPDATE conversations SET is_pinned = false WHERE is_pinned IS NULL;
UPDATE conversations SET is_muted = false WHERE is_muted IS NULL;
UPDATE conversations SET is_archived = false WHERE is_archived IS NULL;
UPDATE conversations SET unread_count = 0 WHERE unread_count IS NULL;
UPDATE conversations SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;

ALTER TABLE conversations
  ALTER COLUMN is_pinned SET DEFAULT false,
  ALTER COLUMN is_muted SET DEFAULT false,
  ALTER COLUMN is_archived SET DEFAULT false,
  ALTER COLUMN unread_count SET DEFAULT 0,
  ALTER COLUMN is_pinned SET NOT NULL,
  ALTER COLUMN is_muted SET NOT NULL,
  ALTER COLUMN is_archived SET NOT NULL,
  ALTER COLUMN unread_count SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

-- ------------------------------------------------------------
-- 2. Message paging: WHERE conversation_id = $1 ORDER BY created_at DESC, id DESC
--    The id tie-breaker is not optional. A webhook batch inserts several rows
--    inside one transaction, so they share created_at to the microsecond; a
--    created_at-only cursor skips every row after the first of each tie, forever.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_messages_convo_created_id
  ON messages (conversation_id, created_at DESC, id DESC);

-- Superseded by the composite above (same leading column, no tie-breaker).
DROP INDEX IF EXISTS idx_messages_convo_created;

-- `whatsapp_msg_id` already carries a UNIQUE constraint, which is a B-tree.
-- A second index on the same column is pure write cost on the hottest path.
DROP INDEX IF EXISTS idx_messages_wa_msg_id;

-- ------------------------------------------------------------
-- 3. Conversation list. Partial indexes: `is_archived = false` appears in every
--    list query, so it belongs in the index predicate rather than its columns —
--    smaller index, cheaper to maintain, and it stays resident in cache.
-- ------------------------------------------------------------

-- Pinned chats: fetched in full on the first page (the set is small and bounded).
CREATE INDEX IF NOT EXISTS idx_conv_pinned_list
  ON conversations (updated_at DESC, id DESC)
  WHERE is_archived = false AND is_pinned = true;

-- Everything else: keyset-paginated on (updated_at, id).
CREATE INDEX IF NOT EXISTS idx_conv_unpinned_list
  ON conversations (updated_at DESC, id DESC)
  WHERE is_archived = false AND is_pinned = false;

-- The "Unread" filter chip. The predicate AND the ordering both come from the
-- index, so this query never sorts.
CREATE INDEX IF NOT EXISTS idx_conv_unread_list
  ON conversations (updated_at DESC, id DESC)
  WHERE is_archived = false AND unread_count > 0;

-- Archived drawer.
CREATE INDEX IF NOT EXISTS idx_conv_archived_list
  ON conversations (updated_at DESC, id DESC)
  WHERE is_archived = true;

-- Search falls back to a single ordered scan over the active set.
CREATE INDEX IF NOT EXISTS idx_conv_active_updated
  ON conversations (updated_at DESC, id DESC)
  WHERE is_archived = false;

-- Superseded by the partial indexes above.
DROP INDEX IF EXISTS idx_conversations_active_list;
DROP INDEX IF EXISTS idx_conversations_unread;
DROP INDEX IF EXISTS idx_conversations_archived_list;
DROP INDEX IF EXISTS idx_conversations_list;

-- Webhook hot path: find-or-create by phone. Usually redundant (phone is UNIQUE
-- in the base schema); kept for databases created before that constraint.
CREATE INDEX IF NOT EXISTS idx_conversations_phone
  ON conversations (phone);

-- ------------------------------------------------------------
-- 4. Label filtering joins the junction table from the label side. The composite
--    primary key (conversation_id, label_id) cannot serve a label_id-first lookup.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_conversation_labels_label
  ON conversation_labels (label_id);

-- ------------------------------------------------------------
-- 5. Search over name / phone. Trigram indexes make ILIKE '%term%' indexable
--    instead of a full scan (a plain B-tree cannot serve a leading wildcard).
--
--    Deliberately NOT indexing `last_message`: it is rewritten on every single
--    inbound and outbound message, so a GIN index there is maintained on the
--    hottest write path in the schema — and message text is already searchable
--    through the `messages` table if you ever add full-text search.
-- ------------------------------------------------------------
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS idx_conversations_name_trgm
    ON conversations USING gin (name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_conversations_phone_trgm
    ON conversations USING gin (phone gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm unavailable — search will fall back to a scan (%)', SQLERRM;
END $$;

DROP INDEX IF EXISTS idx_conversations_last_message_trgm;

-- ------------------------------------------------------------
-- 6. Race-free unread counter.
--    The webhook used to read unread_count, add N in JavaScript and write it
--    back. Two inbound webhooks arriving together lose an increment. Doing the
--    arithmetic in SQL makes it atomic and collapses the read+write into one
--    statement (half the WAL, half the realtime events per inbound message).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bump_conversation_inbound(
  p_id uuid,
  p_count integer,
  p_last_message text,
  p_last_message_type text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE conversations
     SET unread_count       = unread_count + GREATEST(p_count, 0),
         last_message       = p_last_message,
         last_message_type  = COALESCE(p_last_message_type, 'text'),
         last_message_role  = 'user',
         last_message_time  = NOW(),
         updated_at         = NOW()
   WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.bump_conversation_inbound(uuid, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_conversation_inbound(uuid, integer, text, text) FROM anon;
-- The app calls this with the service-role key only.
GRANT EXECUTE ON FUNCTION public.bump_conversation_inbound(uuid, integer, text, text) TO service_role;

-- ------------------------------------------------------------
-- 7. Refresh planner statistics so the new indexes are used immediately.
-- ------------------------------------------------------------
ANALYZE conversations;
ANALYZE messages;
ANALYZE conversation_labels;

-- ============================================================
-- STILL OPEN (deliberately not done here — each needs a decision):
--
--  * RLS is not enabled on `conversations` / `messages`. Anyone holding the
--    public anon key can read every message straight from /rest/v1/messages,
--    bypassing the API routes. Enabling RLS is the right fix, but it must land
--    together with policies for the realtime subscriber role — turning RLS on
--    without them silently stops Realtime from delivering anything.
--
--  * Unread count is a single shared counter, so "read" is team-wide. A
--    per-agent read marker (conversation_reads with a monotonic seen-count,
--    the way Mattermost does it) is the upgrade if you need per-agent unread.
-- ============================================================
