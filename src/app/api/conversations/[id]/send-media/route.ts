import { NextRequest } from "next/server";
import { supabase, getSupabase } from "@/lib/supabase";

const GRAPH_API = "https://graph.facebook.com/v22.0";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const caption = formData.get("caption") as string || "";

  if (!file) return Response.json({ error: "No file" }, { status: 400 });

  const { data: convo } = await supabase.from("conversations").select("phone").eq("id", id).single();
  if (!convo) return Response.json({ error: "Conversation not found" }, { status: 404 });

  const sb = getSupabase();

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());

    // Voice note fix: webm opus → rename to ogg (same codec, WhatsApp accepts ogg)
    const isVoiceWebm = file.type.includes("webm") && file.name.includes("voice_");
    const uploadMime = isVoiceWebm ? "audio/ogg; codecs=opus" : file.type;
    const uploadExt = isVoiceWebm ? "ogg" : (file.name.split(".").pop() || "bin");
    const storagePath = `media/${Date.now()}_sent.${uploadExt}`;

    await sb.storage.createBucket("whatsapp-media", { public: true }).catch(() => {});
    const { error: uploadErr } = await sb.storage.from("whatsapp-media").upload(storagePath, buffer, {
      contentType: uploadMime, cacheControl: "31536000", upsert: false,
    });
    if (uploadErr) return Response.json({ error: "Upload failed: " + uploadErr.message }, { status: 500 });

    const { data: urlData } = sb.storage.from("whatsapp-media").getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    // Determine WhatsApp message type
    let waType = "document";
    if (file.type.startsWith("image/")) waType = "image";
    else if (file.type.startsWith("video/")) waType = "video";
    else if (isVoiceWebm) waType = "audio"; // voice note → audio
    else if (file.type.startsWith("audio/") && !file.type.includes("webm")) waType = "audio";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const waPayload: any = {
      messaging_product: "whatsapp",
      to: convo.phone,
      type: waType,
    };

    if (waType === "image") {
      waPayload.image = { link: publicUrl, ...(caption ? { caption } : {}) };
    } else if (waType === "video") {
      waPayload.video = { link: publicUrl, ...(caption ? { caption } : {}) };
    } else if (waType === "audio") {
      waPayload.audio = { link: publicUrl };
    } else {
      waPayload.document = { link: publicUrl, filename: file.name, ...(caption ? { caption } : {}) };
    }

    const waRes = await fetch(`${GRAPH_API}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(waPayload),
    });
    const waData = await waRes.json();

    if (waData.error) {
      console.error("WhatsApp send error:", waData.error);
      return Response.json({ error: "WhatsApp error: " + (waData.error.message || JSON.stringify(waData.error)) }, { status: 400 });
    }

    const waMsgId = waData.messages?.[0]?.id || null;

    const { data: msg, error: msgErr } = await supabase.from("messages").insert({
      conversation_id: id,
      role: "assistant",
      content: caption || (isVoiceWebm ? "🎵 Voice message" : `[${waType}]`),
      message_type: isVoiceWebm ? "audio" : waType,
      media_url: publicUrl,
      media_mime_type: uploadMime,
      media_filename: isVoiceWebm ? `voice_${Date.now()}.ogg` : file.name,
      media_caption: caption || null,
      whatsapp_msg_id: waMsgId,
      status: "sent",
    }).select().single();

    if (msgErr) return Response.json({ error: msgErr.message }, { status: 500 });

    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);
    return Response.json(msg);
  } catch (error) {
    console.error("Send media error:", error);
    return Response.json({ error: "Failed to send media" }, { status: 500 });
  }
}
