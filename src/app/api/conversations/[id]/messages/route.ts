import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * Messages for one conversation, keyset-paginated.
 *
 *   before=<iso>&beforeId=<uuid>  older page (scroll up)
 *   after=<iso>&afterId=<uuid>    delta: only messages newer than the cursor
 *
 * The id is part of the cursor, not decoration. A webhook batch inserts several
 * rows in one transaction, so they share `created_at` down to the microsecond —
 * a timestamp-only cursor skips every row after the first of each tie and can
 * never recover them. Ordering is (created_at, id) throughout, matching the
 * idx_messages_convo_created_id index from supabase-perf-v2-migration.sql.
 *
 * The delta form is what the dashboard's polling safety net uses, so a quiet chat
 * costs an empty array instead of re-downloading the last 50 rows.
 */

// Explicit columns — `select *` shipped columns the UI never reads.
const COLS =
  "id,conversation_id,role,content,message_type,media_url,media_mime_type,media_filename,media_caption,reply_to_id,reaction,latitude,longitude,location_name,location_address,whatsapp_msg_id,is_deleted,is_starred,status,created_at";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** PostgREST has no row-constructor comparison, so (ts, id) < (a, b) is spelled out. */
function keysetFilter(ts: string, id: string | null, direction: "lt" | "gt"): string {
  if (!id) return `created_at.${direction}.${ts}`;
  return `created_at.${direction}.${ts},and(created_at.eq.${ts},id.${direction}.${id})`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const parsed = parseInt(sp.get("limit") || "", 10);
  const limit = Math.min(Math.max(Number.isFinite(parsed) ? parsed : DEFAULT_LIMIT, 1), MAX_LIMIT);
  const before = sp.get("before");
  const beforeId = sp.get("beforeId");
  const after = sp.get("after");
  const afterId = sp.get("afterId");

  const supabase = getSupabase();

  // Delta mode: oldest-first from the cursor, so nothing is skipped when more
  // than `limit` messages arrived between two polls.
  if (after) {
    const { data, error } = await supabase
      .from("messages")
      .select(COLS)
      .eq("conversation_id", id)
      .or(keysetFilter(after, afterId, "gt"))
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit);
    if (error) return json({ error: error.message }, 500);
    return json(data || []);
  }

  let query = supabase
    .from("messages")
    .select(COLS)
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (before) query = query.or(keysetFilter(before, beforeId, "lt"));

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  // Reverse to chronological order for the frontend.
  return json((data || []).reverse());
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
