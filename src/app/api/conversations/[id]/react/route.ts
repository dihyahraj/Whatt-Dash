import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendWhatsAppReaction } from "@/lib/whatsapp";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { messageId, emoji, whatsappMsgId } = await request.json();

  // Get conversation phone
  const { data: conversation } = await supabase
    .from("conversations")
    .select("phone")
    .eq("id", id)
    .single();

  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Send reaction via WhatsApp if we have the WA msg ID
  if (whatsappMsgId) {
    // Empty emoji = remove reaction (WhatsApp uses empty string to remove)
    await sendWhatsAppReaction(conversation.phone, whatsappMsgId, emoji || "");
  }

  // Store reaction in DB (null = removed)
  const { error } = await supabase
    .from("messages")
    .update({ reaction: emoji || null })
    .eq("id", messageId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ success: true });
}
