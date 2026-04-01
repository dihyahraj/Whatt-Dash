import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

const GRAPH_API = "https://graph.facebook.com/v22.0";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const deleteForEveryone = body?.deleteForEveryone === true;
  const sb = getSupabase();

  // Get message first
  const { data: msg } = await sb.from("messages").select("*").eq("id", id).single();
  if (!msg) return Response.json({ error: "Not found" }, { status: 404 });

  if (deleteForEveryone && msg.whatsapp_msg_id && msg.role === "assistant") {
    // Try to delete on WhatsApp (only works for messages sent by us, within time limit)
    try {
      const token = process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      await fetch(`${GRAPH_API}/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "deleted",
          message_id: msg.whatsapp_msg_id,
        }),
      });
    } catch (e) {
      console.error("WhatsApp delete error:", e);
    }
  }

  // Soft delete in DB
  const { error } = await sb
    .from("messages")
    .update({ is_deleted: true, content: "🚫 This message was deleted" })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true, deletedForEveryone: deleteForEveryone });
}
