-- ============================================================
-- WHATT-DASH: diagnose what is actually slow
--
-- Run this in the Supabase SQL Editor (self-hosted Studio works too) and send
-- back the output of each block. Nothing here writes or changes data — it is all
-- reads, plus EXPLAIN, which only plans and times queries.
--
-- Block 5 and 6 are the important ones: they show whether Postgres is using an
-- index for the two hot queries or sorting the whole history on every open.
-- ============================================================

-- 1. How much data is actually in here, and how big is it on disk?
SELECT 'conversations' AS table,
       (SELECT count(*) FROM conversations) AS rows,
       pg_size_pretty(pg_total_relation_size('conversations')) AS total_size
UNION ALL
SELECT 'messages',
       (SELECT count(*) FROM messages),
       pg_size_pretty(pg_total_relation_size('messages'));

-- 2. The heaviest conversations — the ones where "opening the chat hangs".
SELECT conversation_id, count(*) AS messages
FROM messages
GROUP BY conversation_id
ORDER BY count(*) DESC
LIMIT 10;

-- 3. Which indexes exist today? The v2 migration is applied if you can see
--    idx_messages_convo_created_id and idx_conv_unpinned_list here.
SELECT tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_indexes
JOIN pg_stat_user_indexes USING (schemaname, tablename, indexname)
WHERE tablename IN ('conversations', 'messages', 'conversation_labels')
ORDER BY tablename, indexname;

-- 4. Are the sort/filter columns ever NULL? A NULL in a DESC index sorts FIRST
--    and breaks keyset pagination.
SELECT count(*) FILTER (WHERE is_pinned IS NULL)    AS null_is_pinned,
       count(*) FILTER (WHERE is_archived IS NULL)  AS null_is_archived,
       count(*) FILTER (WHERE unread_count IS NULL) AS null_unread_count,
       count(*) FILTER (WHERE updated_at IS NULL)   AS null_updated_at
FROM conversations;

-- 5. THE HOT QUERY: opening a chat. Replace the id below with the busiest
--    conversation from block 2.
--    Want to see: "Index Scan using idx_messages_convo_created_id"
--    Problem if you see: "Sort" or "Seq Scan on messages"
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, conversation_id, role, content, message_type, media_url, created_at
FROM messages
WHERE conversation_id = (SELECT conversation_id FROM messages
                         GROUP BY conversation_id ORDER BY count(*) DESC LIMIT 1)
ORDER BY created_at DESC, id DESC
LIMIT 25;

-- 6. THE OTHER HOT QUERY: the conversation list.
--    Want to see: "Index Scan using idx_conv_unpinned_list"
--    Problem if you see: "Sort" over thousands of rows.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, phone, name, unread_count, updated_at, last_message
FROM conversations
WHERE is_archived = false AND NOT (is_pinned IS TRUE)
ORDER BY updated_at DESC, id DESC
LIMIT 26;

-- 7. Is autovacuum keeping up? A big n_dead_tup on messages means bloat, which
--    makes every scan read more pages than it needs to.
SELECT relname, n_live_tup, n_dead_tup, last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
WHERE relname IN ('conversations', 'messages')
ORDER BY relname;

-- 8. How much memory does this Postgres actually have to work with? On a
--    self-hosted box the defaults are often left at 128MB shared_buffers, which
--    is small once the messages table outgrows it.
SELECT name, setting, unit
FROM pg_settings
WHERE name IN ('shared_buffers', 'work_mem', 'effective_cache_size', 'max_connections');

-- 9. Storage: how much media is sitting in the bucket, since on a self-hosted
--    setup those bytes are served by your own server.
SELECT count(*) AS objects,
       pg_size_pretty(COALESCE(sum((metadata->>'size')::bigint), 0)) AS total
FROM storage.objects
WHERE bucket_id = 'whatsapp-media';
