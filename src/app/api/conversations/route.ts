import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * Conversation list — paginated, filtered and searched SERVER-SIDE.
 *
 * Before: every client pulled EVERY non-archived conversation (select *) every
 * 10s and filtered/searched in the browser. With a few thousand chats that is a
 * multi-MB payload per poll and a frozen UI. Now the server returns one page of
 * thin rows and owns search/filter, so the payload stays flat no matter how
 * many chats exist.
 *
 * Query params:
 *   limit   page size (default 40, max 100)
 *   offset  page offset
 *   q       search across name / phone / last message
 *   filter  "all" | "unread" | "<labelId>"
 */

// Only the columns the sidebar actually renders (profile_pic_url is unused).
const COLS =
  "id,phone,name,is_pinned,is_muted,is_archived,unread_count,updated_at,created_at,last_message,last_message_type,last_message_role,last_message_time";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;
// The sidebar shows one truncated line — no need to ship whole messages.
const PREVIEW_MAX = 200;

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
  const q = sanitizeSearch(sp.get("q") || "");
  const filter = sp.get("filter") || "all";
  const byLabel = filter !== "all" && filter !== "unread" ? filter : null;

  const supabase = getSupabase();

  // An inner join on the junction table keeps label filtering in the database
  // (no "fetch every id then filter in JS" round trip).
  let query = supabase
    .from("conversations")
    .select(byLabel ? `${COLS},conversation_labels!inner(label_id)` : COLS)
    .eq("is_archived", false);

  if (filter === "unread") query = query.gt("unread_count", 0);
  if (byLabel) query = query.eq("conversation_labels.label_id", byLabel);
  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,last_message.ilike.%${q}%`);
  }

  // Ask for one extra row to learn whether another page exists.
  const { data, error } = await query
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit);

  if (error) return json({ error: error.message }, 500);

  const rows = (data || []) as unknown as Record<string, unknown>[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  if (!page.length) return json({ items: [], hasMore: false });

  const ids = page.map((c) => c.id as string);

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

  const items = page.map((convo) => {
    delete convo.conversation_labels; // join artifact, never sent to the client
    const preview = typeof convo.last_message === "string" ? convo.last_message : null;
    return {
      ...convo,
      last_message: preview && preview.length > PREVIEW_MAX ? preview.slice(0, PREVIEW_MAX) : preview,
      last_message_time: convo.last_message_time || convo.updated_at,
      labels: labelMap[convo.id as string] || [],
    };
  });

  return json({ items, hasMore });
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
