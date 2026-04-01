import { NextRequest } from "next/server";
import { supabase, getSupabase } from "@/lib/supabase";

const GRAPH_API = "https://graph.facebook.com/v25.0";

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
  const isVoice = file.name.includes("voice_");
  const token = process.env.WHATSAPP_ACCESS_TOKEN!;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;

  console.log(`[SEND-MEDIA] file: ${file.name}, size: ${file.size}, type: ${file.type}, isVoice: ${isVoice}`);

  try {
    // 1. Upload to Supabase Storage (for dashboard display)
    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `media/${Date.now()}_sent.${ext}`;
    await sb.storage.createBucket("whatsapp-media", { public: true }).catch(() => {});
    const { error: uploadErr } = await sb.storage.from("whatsapp-media").upload(storagePath, buffer, {
      contentType: file.type, cacheControl: "31536000", upsert: false,
    });
    if (uploadErr) return Response.json({ error: "Storage upload failed: " + uploadErr.message }, { status: 500 });
    const publicUrl = sb.storage.from("whatsapp-media").getPublicUrl(storagePath).data.publicUrl;

    // 2. Determine WhatsApp message type
    // Per Meta docs: audio supports aac, amr, mp3(mpeg), m4a(mp4), ogg(opus only)
    let waType = "document";
    if (file.type.startsWith("image/")) waType = "image";
    else if (file.type.startsWith("video/")) waType = "video";
    else if (
      file.type === "audio/aac" ||
      file.type === "audio/amr" ||
      file.type === "audio/mpeg" ||
      file.type === "audio/mp4" ||
      file.type === "audio/mp3" ||
      file.type === "audio/m4a" ||
      file.type.startsWith("audio/ogg")
    ) waType = "audio";

    console.log(`[SEND-MEDIA] waType: ${waType}`);

    // 3. Upload file to WhatsApp Media API → get media_id
    console.log(`[SEND-MEDIA] Uploading to WhatsApp Media API...`);
    const uploadForm = new FormData();
    uploadForm.append("messaging_product", "whatsapp");
    uploadForm.append("file", new Blob([arrayBuffer], { type: file.type }), file.name);
    uploadForm.append("type", file.type);

    const uploadRes = await fetch(`${GRAPH_API}/${phoneId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: uploadForm,
    });
    const uploadData = await uploadRes.json();
    console.log(`[SEND-MEDIA] Media upload response:`, JSON.stringify(uploadData));

    let waMediaId = uploadData.id || null;

    // 4. Build WhatsApp message payload (exactly per Meta docs)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let waPayload: any;

    if (waMediaId) {
      // Use uploaded media ID
      if (waType === "audio") {
        waPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: convo.phone,
          type: "audio",
          audio: { id: waMediaId },
        };
      } else if (waType === "image") {
        waPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: convo.phone,
          type: "image",
          image: { id: waMediaId, ...(caption ? { caption } : {}) },
        };
      } else if (waType === "video") {
        waPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: convo.phone,
          type: "video",
          video: { id: waMediaId, ...(caption ? { caption } : {}) },
        };
      } else {
        waPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: convo.phone,
          type: "document",
          document: { id: waMediaId, filename: file.name, ...(caption ? { caption } : {}) },
        };
      }
    } else {
      // Media upload failed — fallback to public URL as document
      console.log(`[SEND-MEDIA] Media upload failed, falling back to public URL document`);
      waType = "document";
      waPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: convo.phone,
        type: "document",
        document: { link: publicUrl, filename: file.name, ...(caption ? { caption } : {}) },
      };
    }

    console.log(`[SEND-MEDIA] Sending message:`, JSON.stringify(waPayload));

    // 5. Send message
    const sendRes = await fetch(`${GRAPH_API}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(waPayload),
    });
    const sendData = await sendRes.json();
    console.log(`[SEND-MEDIA] Send response:`, JSON.stringify(sendData));

    if (sendData.error) {
      return Response.json({
        error: "WhatsApp: " + (sendData.error?.error_data?.details || sendData.error.message || JSON.stringify(sendData.error)),
      }, { status: 400 });
    }

    const waMsgId = sendData.messages?.[0]?.id || null;
    console.log(`[SEND-MEDIA] ✅ Sent! waMsgId: ${waMsgId}, type: ${waType}`);

    // 6. Store in DB
    const { data: msg, error: msgErr } = await supabase.from("messages").insert({
      conversation_id: id,
      role: "assistant",
      content: caption || (isVoice ? "🎵 Voice" : `[${waType}]`),
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
    console.error("[SEND-MEDIA] Error:", error);
    return Response.json({ error: "Failed: " + String(error) }, { status: 500 });
  }
}
