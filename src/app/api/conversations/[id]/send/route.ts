import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { message } = body;

  if (!message?.trim()) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  // Get conversation to find phone number
  const { data: conversation, error: convoError } = await supabase
    .from("conversations")
    .select("phone")
    .eq("id", id)
    .single();

  if (convoError || !conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Send via WhatsApp
  // Yeh aapka purana code hai:
  // await sendWhatsAppMessage(conversation.phone, message);

  // Isko hata kar yeh naya code dalein:
  const waResponse = await sendWhatsAppMessage(conversation.phone, message);

  // Agar WhatsApp ki taraf se error aata hai toh API wahi ruk jaye:
  if (waResponse.error) {
    console.error("WhatsApp API Error:", waResponse.error);
    return Response.json(
      { error: "WhatsApp API failed", details: waResponse.error }, 
      { status: 400 }
    );
  }

  // Store in DB
  const { data: msg, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: id,
      role: "assistant",
      content: message,
    })
    .select()
    .single();

  if (msgError) {
    return Response.json({ error: msgError.message }, { status: 500 });
  }

  // Update conversation timestamp
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  return Response.json(msg);
}
