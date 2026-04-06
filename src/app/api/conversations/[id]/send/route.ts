import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage, sendWhatsAppReply } from "@/lib/whatsapp";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { message, replyToMsgId, replyToWhatsappId } = body;

  if (!message?.trim()) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  const { data: conversation, error: convoError } = await supabase
    .from("conversations")
    .select("phone")
    .eq("id", id)
    .single();

  if (convoError || !conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Send via WhatsApp (with or without reply context)
  let waResponse;
  if (replyToWhatsappId) {
    waResponse = await sendWhatsAppReply(conversation.phone, message, replyToWhatsappId);
  } else {
    waResponse = await sendWhatsAppMessage(conversation.phone, message);
  }

  if (waResponse.error) {
    console.error("WhatsApp API Error:", waResponse.error);
    return Response.json(
      { error: "WhatsApp API failed", details: waResponse.error },
      { status: 400 }
    );
  }

  // Get the WA message ID from response
  const waMsgId = waResponse.messages?.[0]?.id || null;

  // Store in DB
  const { data: msg, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: id,
      role: "assistant",
      content: message,
      message_type: "text",
      reply_to_id: replyToMsgId || null,
      whatsapp_msg_id: waMsgId,
      status: "sent",
    })
    .select()
    .single();

  if (msgError) {
    return Response.json({ error: msgError.message }, { status: 500 });
  }

  await supabase
    .from("conversations")
    .update({
      updated_at: new Date().toISOString(),
      last_message: message,
      last_message_type: "text",
      last_message_role: "assistant",
      last_message_time: new Date().toISOString(),
    })
    .eq("id", id);

  return Response.json(msg);
}
