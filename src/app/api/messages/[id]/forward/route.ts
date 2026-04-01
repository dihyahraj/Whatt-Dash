import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { targetConversationIds } = await request.json(); // array of IDs
  const sb = getSupabase();

  const { data: msg } = await sb.from("messages").select("*").eq("id", id).single();
  if (!msg) return Response.json({ error: "Message not found" }, { status: 404 });

  const results = [];
  for (const targetId of (targetConversationIds || [])) {
    const { data: targetConvo } = await sb.from("conversations").select("phone").eq("id", targetId).single();
    if (!targetConvo) continue;

    // Send original message WITHOUT "Forwarded:" prefix — customer sees clean message
    const waRes = await sendWhatsAppMessage(targetConvo.phone, msg.content);
    const waMsgId = waRes.messages?.[0]?.id || null;

    const { data: newMsg } = await sb.from("messages").insert({
      conversation_id: targetId,
      role: "assistant",
      content: msg.content,
      message_type: "text",
      whatsapp_msg_id: waMsgId,
      status: "sent",
    }).select().single();

    await sb.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", targetId);
    if (newMsg) results.push(newMsg);
  }

  return Response.json({ forwarded: results.length });
}
