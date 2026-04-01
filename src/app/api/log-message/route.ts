import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

const API_KEY = process.env.N8N_API_KEY || "bioshop-whatt-dash-2024";

// GET = health check (test if API is reachable)
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (key !== API_KEY) return Response.json({ error: "Invalid API key" }, { status: 401 });
  return Response.json({ status: "ok", time: new Date().toISOString() });
}

// POST = log a message sent by n8n/external system
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, message, name, source, key } = body;

    // Simple API key auth
    if (key !== API_KEY) {
      return Response.json({ error: "Invalid API key. Add key field." }, { status: 401 });
    }

    if (!phone || !message) {
      return Response.json({ error: "phone and message required" }, { status: 400 });
    }

    const cleanPhone = phone.toString().replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "92").replace(/^(\d{10})$/, "92$1");
    const sb = getSupabase();

    // Find or create conversation
    let { data: convo } = await sb.from("conversations").select("*").eq("phone", cleanPhone).single();

    if (!convo) {
      const { data: newConvo, error: createErr } = await sb.from("conversations").insert({
        phone: cleanPhone, name: name || null, updated_at: new Date().toISOString(),
      }).select().single();
      if (createErr) return Response.json({ error: createErr.message }, { status: 500 });
      convo = newConvo;
    } else if (name && !convo.name) {
      await sb.from("conversations").update({ name }).eq("id", convo.id);
    }

    // Store message
    const { data: msg, error: msgErr } = await sb.from("messages").insert({
      conversation_id: convo.id, role: "assistant", content: message,
      message_type: "text", status: "sent",
    }).select().single();

    if (msgErr) return Response.json({ error: msgErr.message }, { status: 500 });
    await sb.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convo.id);

    return Response.json({ success: true, conversation_id: convo.id, message_id: msg.id, source: source || "n8n" });
  } catch (error) {
    return Response.json({ error: "Server error: " + String(error) }, { status: 500 });
  }
}
