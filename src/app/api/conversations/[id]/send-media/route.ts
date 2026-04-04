import { NextRequest } from "next/server";
import { supabase, getSupabase } from "@/lib/supabase";

const GRAPH_API = "https://graph.facebook.com/v20.0";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const caption = formData.get("caption") as string || "";
  const forceType = formData.get("forceType") as string || "";

  if (!file) return Response.json({ error: "No file" }, { status: 400 });
  
  // WhatsApp file size limits
  const maxSize = file.type?.startsWith("video/") ? 16 * 1024 * 1024 : 
                  file.type?.startsWith("image/") ? 5 * 1024 * 1024 :
                  file.type?.startsWith("audio/") ? 16 * 1024 * 1024 : 100 * 1024 * 1024;
  if (file.size > maxSize) {
    return Response.json({ error: `File too large (${(file.size/1024/1024).toFixed(1)}MB). Max: ${(maxSize/1024/1024).toFixed(0)}MB for ${file.type?.split("/")[0] || "this type"}` }, { status: 400 });
  }

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
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const safeName = `${Date.now()}_sent.${ext}`;
    const storagePath = `media/${safeName}`;
    await sb.storage.createBucket("whatsapp-media", { public: true }).catch(() => {});
    const { error: uploadErr } = await sb.storage.from("whatsapp-media").upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream", cacheControl: "31536000", upsert: false,
    });
    if (uploadErr) return Response.json({ error: "Storage upload failed: " + uploadErr.message }, { status: 500 });
    const rawPublicUrl = sb.storage.from("whatsapp-media").getPublicUrl(storagePath).data.publicUrl;
    // Fix: replace internal Docker URL with public URL for browser access
    const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const internalUrl = process.env.SUPABASE_INTERNAL_URL || "";
    const publicUrl = internalUrl && rawPublicUrl.includes(internalUrl) 
      ? rawPublicUrl.replace(internalUrl, publicSupabaseUrl)
      : rawPublicUrl;

    // 2. Determine WhatsApp message type
    // Detect MIME from extension if file.type is empty (mobile browsers)
    let mimeType = file.type;
    if (!mimeType || mimeType === "application/octet-stream") {
      const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", mp4: "video/mp4", mov: "video/quicktime", avi: "video/x-msvideo", mkv: "video/x-matroska", mp3: "audio/mpeg", ogg: "audio/ogg", m4a: "audio/mp4", wav: "audio/wav", opus: "audio/opus", pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
      mimeType = mimeMap[ext] || "application/octet-stream";
    }

    let waType = "document";
    if (mimeType.startsWith("image/")) waType = "image";
    else if (mimeType.startsWith("video/")) waType = "video";
    else if (
      mimeType === "audio/aac" || mimeType === "audio/amr" || mimeType === "audio/mpeg" ||
      mimeType === "audio/mp4" || mimeType === "audio/mp3" || mimeType === "audio/m4a" ||
      mimeType.startsWith("audio/ogg") || mimeType === "audio/opus" || mimeType === "audio/wav"
    ) waType = "audio";

    // Override with forceType if provided
    if (forceType === "document" || forceType === "audio") waType = forceType;

    console.log(`[SEND-MEDIA] waType: ${waType}, forceType: ${forceType}`);

    // 3. Upload file to WhatsApp Media API → get media_id
    let uploadMime = file.type || mimeType;
    // Fix: mobile browsers send MIME types WhatsApp doesn't accept
    if (uploadMime === "video/quicktime") uploadMime = "video/mp4";
    if (uploadMime === "video/x-msvideo") uploadMime = "video/mp4";
    if (uploadMime === "video/x-matroska") uploadMime = "video/mp4";
    console.log(`[SEND-MEDIA] Uploading to WhatsApp Media API... uploadMime: ${uploadMime}, fileType: ${file.type}, detected: ${mimeType}, size: ${file.size}, name: ${file.name}`);
    
    // Create a proper File object for Meta API
    const metaFile = new File([buffer], file.name, { type: uploadMime });
    const uploadForm = new FormData();
    uploadForm.append("messaging_product", "whatsapp");
    uploadForm.append("file", metaFile);
    uploadForm.append("type", uploadMime);

    const uploadRes = await fetch(`${GRAPH_API}/${phoneId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: uploadForm,
    });
    const uploadData = await uploadRes.json();
    console.log(`[SEND-MEDIA] Media upload response:`, JSON.stringify(uploadData));
    const waMediaId = uploadData.id || null;

    if (!waMediaId) {
      console.error(`[SEND-MEDIA] Media API upload failed:`, JSON.stringify(uploadData));
      return Response.json({ error: "WhatsApp media upload failed: " + (uploadData.error?.message || "Unknown error. File may be too large or unsupported format.") }, { status: 400 });
    }

    // 4. Build WhatsApp message payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let waPayload: any;

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
      media_mime_type: mimeType,
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
