import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * Messages for one conversation.
 *
 *   before=<iso>  older page (scroll up) — newest-first window, returned ascending
 *   after=<iso>   delta: ONLY messages newer than this. The dashboard's polling
 *                 safety net uses it, so a quiet chat costs an empty array
 *                 instead of re-downloading the last 50 rows every few seconds.
 *
 * Backed by the (conversation_id, created_at DESC) composite index added in
 * supabase-perf-v2-migration.sql.
 */

// Explicit columns — `select *` shipped columns the UI never reads.
const COLS =
  "id,conversation_id,role,content,message_type,media_url,media_mime_type,media_filename,media_caption,reply_to_id,reaction,latitude,longitude,location_name,location_address,whatsapp_msg_id,is_deleted,is_starred,status,created_at";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const parsed = parseInt(sp.get("limit") || "", 10);
  const limit = Math.min(Math.max(Number.isFinite(parsed) ? parsed : DEFAULT_LIMIT, 1), MAX_LIMIT);
  const before = sp.get("before");
  const after = sp.get("after");

  const supabase = getSupabase();

  // Delta mode: oldest-first from the cursor, so nothing is skipped when more
  // than `limit` messages arrived between two polls.
  if (after) {
    const { data, error } = await supabase
      .from("messages")
      .select(COLS)
      .eq("conversation_id", id)
      .gt("created_at", after)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) return json({ error: error.message }, 500);
    return json(data || []);
  }

  let query = supabase
    .from("messages")
    .select(COLS)
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  // Reverse to chronological order for the frontend.
  return json((data || []).reverse());
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
