import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * Archived conversations.
 *
 * Before: one extra `messages` query PER archived conversation (an N+1 that ran
 * on every dashboard mount — 200 archived chats meant 201 queries). The last
 * message is denormalized onto `conversations` since the perf migration, so a
 * single thin, paginated query is enough.
 */

const COLS =
  "id,phone,name,is_pinned,is_muted,is_archived,unread_count,updated_at,created_at,last_message,last_message_type,last_message_role,last_message_time";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;
const PREVIEW_MAX = 200;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const parsedLimit = parseInt(sp.get("limit") || "", 10);
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_LIMIT, 1), MAX_LIMIT);
  const parsedOffset = parseInt(sp.get("offset") || "", 10);
  const offset = Math.max(Number.isFinite(parsedOffset) ? parsedOffset : 0, 0);

  const { data, error } = await getSupabase()
    .from("conversations")
    .select(COLS)
    .eq("is_archived", true)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit);

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: { "cache-control": "no-store" } });
  }

  const rows = data || [];
  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map((convo) => ({
    ...convo,
    last_message:
      typeof convo.last_message === "string" && convo.last_message.length > PREVIEW_MAX
        ? convo.last_message.slice(0, PREVIEW_MAX)
        : convo.last_message,
    last_message_time: convo.last_message_time || convo.updated_at,
    labels: [],
  }));

  return Response.json({ items, hasMore }, { headers: { "cache-control": "no-store" } });
}
