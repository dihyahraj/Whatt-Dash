import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const deleteForEveryone = body?.deleteForEveryone === true;
  const sb = getSupabase();

  if (deleteForEveryone) {
    // Delete for everyone = soft delete (shows "message was deleted" for all users)
    const { error } = await sb
      .from("messages")
      .update({ is_deleted: true, content: "🚫 This message was deleted" })
      .eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  } else {
    // Delete for me = hard delete from DB (only this user won't see it)
    const { error } = await sb.from("messages").delete().eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
