// ============================================================
// Download WhatsApp media and upload to Supabase Storage
// ============================================================

import { getSupabase } from "@/lib/supabase";

const GRAPH_API = "https://graph.facebook.com/v25.0";
const BUCKET = "whatsapp-media";

// Ensure bucket exists (call once on first use)
let bucketChecked = false;
async function ensureBucket() {
  if (bucketChecked) return;
  const supabase = getSupabase();
  // Try to create bucket (will fail silently if exists)
  await supabase.storage.createBucket(BUCKET, { public: true });
  bucketChecked = true;
}

/**
 * Downloads media from WhatsApp and uploads to Supabase Storage.
 * Returns the public URL or null on failure.
 */
export async function downloadAndStoreMedia(
  mediaId: string,
  mimeType: string,
  filenameHint?: string
): Promise<string | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    console.error("No WHATSAPP_ACCESS_TOKEN");
    return null;
  }

  try {
    // Step 1: Get download URL from WhatsApp
    const metaRes = await fetch(`${GRAPH_API}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) {
      console.error("Media meta fetch failed:", metaRes.status, await metaRes.text());
      return null;
    }
    const meta = await metaRes.json();
    if (!meta.url) {
      console.error("No download URL in meta response");
      return null;
    }

    // Step 2: Download the file
    const mediaRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!mediaRes.ok) {
      console.error("Media download failed:", mediaRes.status);
      return null;
    }
    const arrayBuffer = await mediaRes.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Step 3: Generate filename
    const ext = getExtension(mimeType, filenameHint);
    const filename = `${Date.now()}_${mediaId.slice(-8)}${ext}`;
    const storagePath = `media/${filename}`;

    // Step 4: Upload to Supabase Storage
    await ensureBucket();
    const supabase = getSupabase();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return null;
    }

    // Step 5: Get public URL (use external URL for browser access)
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    // Replace internal Docker URL with external URL for browser access
    const externalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const internalUrl = process.env.SUPABASE_INTERNAL_URL;
    let publicUrl = urlData.publicUrl;
    if (externalUrl && internalUrl && publicUrl.includes(internalUrl)) {
      publicUrl = publicUrl.replace(internalUrl, externalUrl);
    }

    return publicUrl;
  } catch (error) {
    console.error("downloadAndStoreMedia error:", error);
    return null;
  }
}

function getExtension(mimeType: string, filename?: string): string {
  // Try from filename first
  if (filename) {
    const match = filename.match(/\.[a-zA-Z0-9]+$/);
    if (match) return match[0];
  }
  // Fallback to mime type
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/3gpp": ".3gp",
    "audio/ogg": ".ogg",
    "audio/opus": ".opus",
    "audio/mpeg": ".mp3",
    "audio/aac": ".aac",
    "audio/amr": ".amr",
    "application/pdf": ".pdf",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "image/webp; codecs=vp8": ".webp",
  };
  return map[mimeType] || ".bin";
}
