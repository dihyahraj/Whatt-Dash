import { NextRequest } from "next/server";
import { supabase, getSupabase } from "@/lib/supabase";

const GRAPH_API = "https://graph.facebook.com/v22.0";

// Upload file to WhatsApp Media API and get media_id
async function uploadToWhatsApp(fileArrayBuffer: ArrayBuffer, mimeType: string, filename: string): Promise<string | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  
  console.log(`Uploading to WhatsApp: ${filename} (${mimeType}, ${fileArrayBuffer.byteLength} bytes)`);
  
  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append("file", new Blob([fileArrayBuffer], { type: mimeType }), filename);
  formData.append("type", mimeType);

  const res = await fetch(`${GRAPH_API}/${phoneId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (data.error) {
    console.error("WhatsApp media upload error:", JSON.stringify(data.error));
    return null;
  }
  console.log("WhatsApp media uploaded, ID:", data.id);
  return data.id || null;
}

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
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  try {
    // 1. Upload to Supabase Storage (for our dashboard display)
    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `media/${Date.now()}_sent.${ext}`;

    await sb.storage.createBucket("whatsapp-media", { public: true }).catch(() => {});
    const { error: uploadErr } = await sb.storage.from("whatsapp-media").upload(storagePath, buffer, {
      contentType: file.type, cacheControl: "31536000", upsert: false,
    });
    if (uploadErr) return Response.json({ error: "Storage upload failed: " + uploadErr.message }, { status: 500 });

    const { data: urlData } = sb.storage.from("whatsapp-media").getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;
    console.log("Supabase public URL:", publicUrl);

    // 2. Determine type
    const isVoice = file.name.includes("voice_");
    let waType = "document";
    let waMime = file.type;
    if (file.type.startsWith("image/")) waType = "image";
    else if (file.type.startsWith("video/")) waType = "video";
    else if (file.type.startsWith("audio/") && !file.type.includes("webm") && !isVoice) waType = "audio";
    // Voice notes: keep as document type (browser webm → WhatsApp can't play as voice)
    // Non-webm audio (aac, mp3, ogg): send as audio type

    // 3. Upload to WhatsApp Media API (skip for voice — use public URL directly)
    let waMediaId: string | null = null;
    if (!isVoice) {
      waMediaId = await uploadToWhatsApp(arrayBuffer, waMime, file.name);
    } else {
      console.log("Voice note: skipping Media API upload, using Supabase public URL as document");
    }

    // 4. Send message
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let waPayload: any;

    if (waMediaId) {
      // Send using uploaded media ID (most reliable)
      waPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: convo.phone,
        type: waType,
        [waType]: waType === "document"
          ? { id: waMediaId, filename: file.name, ...(caption ? { caption } : {}) }
          : waType === "audio"
            ? { id: waMediaId, ...(isVoice ? { voice: true } : {}) }
            : { id: waMediaId, ...(caption ? { caption } : {}) },
      };
    } else {
      // Fallback: send using public link
      waPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: convo.phone,
        type: waType,
        [waType]: waType === "document"
          ? { link: publicUrl, filename: file.name, ...(caption ? { caption } : {}) }
          : waType === "audio"
            ? { link: publicUrl, ...(isVoice ? { voice: true } : {}) }
            : { link: publicUrl, ...(caption ? { caption } : {}) },
      };
    }

    console.log("WhatsApp send payload:", JSON.stringify(waPayload, null, 2));
    const waRes = await fetch(`${GRAPH_API}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(waPayload),
    });
    const waData = await waRes.json();

    if (waData.error) {
      console.error("WhatsApp send error:", JSON.stringify(waData.error));
      console.error("Full WA response:", JSON.stringify(waData));
      return Response.json({ error: "WhatsApp: " + (waData.error?.error_data?.details || waData.error.message || JSON.stringify(waData.error)) }, { status: 400 });
    }

    const waMsgId = waData.messages?.[0]?.id || null;
    console.log("WhatsApp message sent! ID:", waMsgId, "type:", waType, "isVoice:", isVoice);

    // 5. Store in DB
    const { data: msg, error: msgErr } = await supabase.from("messages").insert({
      conversation_id: id,
      role: "assistant",
      content: caption || (isVoice ? "🎵 Voice message" : `[${waType}]`),
      message_type: isVoice ? "audio" : waType,
      media_url: publicUrl,
      media_mime_type: file.type,
      media_filename: file.name,
      media_caption: caption || null,
      whatsapp_msg_id: waMsgId,
      status: "sent",
    }).select().single();

    if (msgErr) return Response.json({ error: msgErr.message }, { status: 500 });

    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);
    return Response.json(msg);
  } catch (error) {
    console.error("Send media error:", error);
    return Response.json({ error: "Failed to send: " + String(error) }, { status: 500 });
  }
}
