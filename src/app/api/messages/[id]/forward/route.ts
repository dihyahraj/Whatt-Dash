import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { targetConversationId } = await request.json();
  const sb = getSupabase();

  // Get source message
  const { data: msg } = await sb.from("messages").select("*").eq("id", id).single();
  if (!msg) return Response.json({ error: "Message not found" }, { status: 404 });

  // Get target conversation phone
  const { data: targetConvo } = await sb.from("conversations").select("phone").eq("id", targetConversationId).single();
  if (!targetConvo) return Response.json({ error: "Target not found" }, { status: 404 });

  // Forward text via WhatsApp
  const fwdText = `▶️ Forwarded:\n${msg.content}`;
  const waRes = await sendWhatsAppMessage(targetConvo.phone, fwdText);
  const waMsgId = waRes.messages?.[0]?.id || null;

  // Store in DB
  const { data: newMsg, error } = await sb.from("messages").insert({
    conversation_id: targetConversationId,
    role: "assistant",
    content: fwdText,
    message_type: "text",
    whatsapp_msg_id: waMsgId,
    status: "sent",
  }).select().single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await sb.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", targetConversationId);
  return Response.json(newMsg);
}
