import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

// n8n calls this AFTER sending a message to log it in Whatt Dash
// POST /api/log-message
// Body: { phone: "923001234567", message: "Hello...", name?: "Customer Name", source?: "n8n" }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { phone, message, name, source } = body;

  if (!phone || !message) {
    return Response.json({ error: "phone and message required" }, { status: 400 });
  }

  // Clean phone number
  const cleanPhone = phone.toString().replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "92").replace(/^(\d{10})$/, "92$1");

  const sb = getSupabase();

  try {
    // Find or create conversation
    let { data: convo } = await sb
      .from("conversations")
      .select("*")
      .eq("phone", cleanPhone)
      .single();

    if (!convo) {
      // Create new conversation
      const { data: newConvo, error: createErr } = await sb
        .from("conversations")
        .insert({
          phone: cleanPhone,
          name: name || null,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createErr) return Response.json({ error: createErr.message }, { status: 500 });
      convo = newConvo;
    } else if (name && !convo.name) {
      // Update name if we have it and convo doesn't
      await sb.from("conversations").update({ name }).eq("id", convo.id);
    }

    // Store the message
    const { data: msg, error: msgErr } = await sb
      .from("messages")
      .insert({
        conversation_id: convo.id,
        role: "assistant", // sent BY us
        content: message,
        message_type: "text",
        status: "sent",
      })
      .select()
      .single();

    if (msgErr) return Response.json({ error: msgErr.message }, { status: 500 });

    // Update conversation timestamp
    await sb.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convo.id);

    return Response.json({ 
      success: true, 
      conversation_id: convo.id, 
      message_id: msg.id,
      source: source || "external",
    });
  } catch (error) {
    console.error("[LOG-MESSAGE] Error:", error);
    return Response.json({ error: "Failed: " + String(error) }, { status: 500 });
  }
}
