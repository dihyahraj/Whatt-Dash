import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

/**
 * Mark a conversation read.
 *
 * The `unread_count > 0` guard matters more than it looks: without it every
 * call wrote the row even when it was already zero, and each write emitted a
 * Realtime `conversations` UPDATE to every connected dashboard, which each
 * answered with a full conversation-list refetch. That feedback loop was a
 * large part of the "app hangs" behaviour. A no-op now touches nothing.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { error } = await getSupabase()
    .from("conversations")
    .update({ unread_count: 0 })
    .eq("id", id)
    .gt("unread_count", 0);

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: { "cache-control": "no-store" } });
  }
  return Response.json({ success: true }, { headers: { "cache-control": "no-store" } });
}
