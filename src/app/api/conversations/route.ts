import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * Conversation list — paginated, filtered and searched SERVER-SIDE.
 *
 * Before: every client pulled EVERY non-archived conversation (select *) every
 * 10s and filtered/searched in the browser. With a few thousand chats that is a
 * multi-MB payload per poll and a frozen UI.
 *
 * Pagination is keyset, not OFFSET. The list is ordered by `updated_at`, which
 * changes every time a message arrives, so rows shift between requests — with
 * OFFSET a chat that moved up is served twice and the one it displaced is never
 * served at all. A cursor is immune to that.
 *
 * Pinned chats are fetched whole on the first page instead of being paginated:
 * the set is small and bounded, and keeping the boolean out of the cursor keeps
 * every query a single-direction index scan (see idx_conv_pinned_list /
 * idx_conv_unpinned_list in supabase-perf-v2-migration.sql).
 *
 * Query params:
 *   limit   page size (default 40, max 100)
 *   cursor  `updated_at` of the last row received (keyset, non-search mode)
 *   offset  page offset — search mode only
 *   q       search across name / phone / last message
 *   filter  "all" | "unread" | "<labelId>"
 */

// Only the columns the sidebar actually renders (profile_pic_url is unused).
const COLS =
  "id,phone,name,is_pinned,is_muted,is_archived,unread_count,updated_at,created_at,last_message,last_message_type,last_message_role,last_message_time";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;
const MAX_PINNED = 100;
// The sidebar shows one truncated line — no need to ship whole messages.
const PREVIEW_MAX = 200;

type Row = Record<string, unknown>;

/** Strip characters that would break PostgREST's or()/ilike filter grammar. */
function sanitizeSearch(q: string): string {
  return q.replace(/[%_,()\\"*]/g, " ").trim();
}

function toInt(v: string | null, fallback: number): number {
  const n = parseInt(v || "", 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(toInt(sp.get("limit"), DEFAULT_LIMIT), 1), MAX_LIMIT);
  const offset = Math.max(toInt(sp.get("offset"), 0), 0);
  const cursor = sp.get("cursor");
  const q = sanitizeSearch(sp.get("q") || "");
  const filter = sp.get("filter") || "all";
  const byLabel = filter !== "all" && filter !== "unread" ? filter : null;

  const supabase = getSupabase();

  /** Base query with the active filters applied. */
  const base = () => {
    // An inner join on the junction table keeps label filtering in the database
    // (no "fetch every id then filter in JS" round trip).
    let query = supabase
      .from("conversations")
      .select(byLabel ? `${COLS},conversation_labels!inner(label_id)` : COLS)
      .eq("is_archived", false);
    if (filter === "unread") query = query.gt("unread_count", 0);
    if (byLabel) query = query.eq("conversation_labels.label_id", byLabel);
    if (q) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,last_message.ilike.%${q}%`);
    return query;
  };

  let rows: Row[];
  let hasMore: boolean;

  if (q) {
    // Search: one ordered pass with offset paging. Result sets are small, and a
    // cursor would fight the fact that a search can match anywhere in the list.
    const { data, error } = await base()
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit);
    if (error) return json({ error: error.message }, 500);
    const all = (data || []) as unknown as Row[];
    hasMore = all.length > limit;
    rows = hasMore ? all.slice(0, limit) : all;
  } else {
    // First page also carries every pinned chat.
    const pinned: Row[] = [];
    if (!cursor) {
      const { data, error } = await base()
        .eq("is_pinned", true)
        .order("updated_at", { ascending: false })
        .limit(MAX_PINNED);
      if (error) return json({ error: error.message }, 500);
      pinned.push(...((data || []) as unknown as Row[]));
    }

    // `not is_pinned is true` rather than `= false`, so a row where the column is
    // somehow NULL still lands in exactly one of the two queries. With `= false`
    // it would match neither and the chat would silently vanish from the sidebar.
    let query = base()
      .not("is_pinned", "is", true)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);
    if (cursor) query = query.lt("updated_at", cursor);

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    const unpinned = (data || []) as unknown as Row[];
    hasMore = unpinned.length > limit;
    rows = [...pinned, ...(hasMore ? unpinned.slice(0, limit) : unpinned)];
  }

  if (!rows.length) return json({ items: [], hasMore: false, nextCursor: null });

  const ids = rows.map((c) => c.id as string);

  // One extra query for the labels of THIS page only.
  const { data: labelRows } = await supabase
    .from("conversation_labels")
    .select("conversation_id, labels(id, name, color)")
    .in("conversation_id", ids);

  const labelMap: Record<string, unknown[]> = {};
  for (const row of labelRows || []) {
    if (!row.labels) continue;
    (labelMap[row.conversation_id] ||= []).push(row.labels);
  }

  const items: Row[] = rows.map((convo) => {
    delete convo.conversation_labels; // join artifact, never sent to the client
    const preview = typeof convo.last_message === "string" ? convo.last_message : null;
    return {
      ...convo,
      last_message: preview && preview.length > PREVIEW_MAX ? preview.slice(0, PREVIEW_MAX) : preview,
      last_message_time: convo.last_message_time || convo.updated_at,
      labels: labelMap[convo.id as string] || [],
    };
  });

  // Cursor = oldest unpinned row served. Pinned rows never advance it (they are
  // not part of the paginated set).
  const lastUnpinned = [...items].reverse().find((c) => !c.is_pinned);
  const nextCursor = hasMore && !q ? ((lastUnpinned?.updated_at as string) ?? null) : null;

  return json({ items, hasMore, nextCursor });
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
