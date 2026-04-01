import { NextRequest } from "next/server";

const GRAPH_API = "https://graph.facebook.com/v25.0";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const { mediaId } = await params;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!token) {
    return new Response("No access token configured", { status: 500 });
  }

  try {
    // Step 1: Get the download URL from WhatsApp
    const metaRes = await fetch(`${GRAPH_API}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!metaRes.ok) {
      console.error("Media meta fetch failed:", metaRes.status);
      return new Response("Media not found", { status: 404 });
    }

    const meta = await metaRes.json();
    const downloadUrl = meta.url;
    const mimeType = meta.mime_type || "application/octet-stream";

    if (!downloadUrl) {
      return new Response("No download URL", { status: 404 });
    }

    // Step 2: Download the actual media file
    const mediaRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!mediaRes.ok) {
      console.error("Media download failed:", mediaRes.status);
      return new Response("Failed to download media", { status: 500 });
    }

    const arrayBuffer = await mediaRes.arrayBuffer();

    return new Response(new Uint8Array(arrayBuffer), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": `inline; filename="media"`,
      },
    });
  } catch (error) {
    console.error("Media proxy error:", error);
    return new Response("Error fetching media", { status: 500 });
  }
}
