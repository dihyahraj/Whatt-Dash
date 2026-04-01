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

    // 2. Determine type
    const isVoice = file.name.includes("voice_");
    let waType = "document";
    let waMime = file.type;
    let waFilename = file.name;
    if (file.type.startsWith("image/")) waType = "image";
    else if (file.type.startsWith("video/")) waType = "video";
    else if (isVoice) {
      // Voice note: tell WhatsApp it's ogg/opus (same opus codec, WhatsApp might accept)
      waType = "audio";
      waMime = "audio/ogg; codecs=opus";
      waFilename = file.name.replace(".webm", ".ogg");
    }
    else if (file.type.startsWith("audio/") && !file.type.includes("webm")) { waType = "audio"; }

    // 3. Upload to WhatsApp Media API
    let waMediaId = await uploadToWhatsApp(arrayBuffer, waMime, waFilename);
    
    // If voice upload as ogg failed, try original webm format
    if (!waMediaId && isVoice) {
      console.log("Retrying voice upload with original webm format...");
      waMediaId = await uploadToWhatsApp(arrayBuffer, file.type, file.name);
    }
    
    // If still no media ID for voice, fall back to document type
    if (!waMediaId && isVoice) {
      console.log("Voice upload failed, falling back to document type");
      waType = "document";
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
        to: convo.phone,
        type: waType,
        [waType]: waType === "document"
          ? { id: waMediaId, filename: file.name, ...(caption ? { caption } : {}) }
          : waType === "audio"
            ? { id: waMediaId }
            : { id: waMediaId, ...(caption ? { caption } : {}) },
      };
    } else {
      // Fallback: send using public link
      waPayload = {
        messaging_product: "whatsapp",
        to: convo.phone,
        type: waType,
        [waType]: waType === "document"
          ? { link: publicUrl, filename: file.name, ...(caption ? { caption } : {}) }
          : waType === "audio"
            ? { link: publicUrl }
            : { link: publicUrl, ...(caption ? { caption } : {}) },
      };
    }

    const waRes = await fetch(`${GRAPH_API}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(waPayload),
    });
    const waData = await waRes.json();

    if (waData.error) {
      console.error("WhatsApp send error:", waData.error);
      return Response.json({ error: "WhatsApp: " + (waData.error.message || JSON.stringify(waData.error)) }, { status: 400 });
    }

    const waMsgId = waData.messages?.[0]?.id || null;

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
