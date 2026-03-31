import { NextRequest } from "next/server";
import { getWhatsAppMediaUrl, downloadWhatsAppMedia } from "@/lib/whatsapp";

// Proxy endpoint to download WhatsApp media
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params;

  const mediaUrl = await getWhatsAppMediaUrl(mediaId);
  if (!mediaUrl) {
    return new Response("Media not found", { status: 404 });
  }

  const buffer = await downloadWhatsAppMedia(mediaUrl);
  if (!buffer) {
    return new Response("Failed to download media", { status: 500 });
  }

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
