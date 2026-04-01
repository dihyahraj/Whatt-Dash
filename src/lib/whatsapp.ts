// ============================================================
// WHATT-DASH: Enhanced WhatsApp Cloud API Helper
// ============================================================

const GRAPH_API = "https://graph.facebook.com/v25.0";

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function getPhoneId() {
  return process.env.WHATSAPP_PHONE_NUMBER_ID;
}

// Send a text message
export async function sendWhatsAppMessage(to: string, body: string) {
  const res = await fetch(`${GRAPH_API}/${getPhoneId()}/messages`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  return res.json();
}

// Send a reply to a specific message
export async function sendWhatsAppReply(to: string, body: string, replyToMsgId: string) {
  const res = await fetch(`${GRAPH_API}/${getPhoneId()}/messages`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
      context: { message_id: replyToMsgId },
    }),
  });
  return res.json();
}

// Send a reaction to a message
export async function sendWhatsAppReaction(to: string, messageId: string, emoji: string) {
  const res = await fetch(`${GRAPH_API}/${getPhoneId()}/messages`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "reaction",
      reaction: { message_id: messageId, emoji },
    }),
  });
  return res.json();
}

// Send an image message
export async function sendWhatsAppImage(to: string, imageUrl: string, caption?: string) {
  const res = await fetch(`${GRAPH_API}/${getPhoneId()}/messages`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: imageUrl, ...(caption ? { caption } : {}) },
    }),
  });
  return res.json();
}

// Send a document message
export async function sendWhatsAppDocument(to: string, docUrl: string, filename: string, caption?: string) {
  const res = await fetch(`${GRAPH_API}/${getPhoneId()}/messages`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: { link: docUrl, filename, ...(caption ? { caption } : {}) },
    }),
  });
  return res.json();
}

// Download media from WhatsApp (2-step: get URL, then download)
export async function getWhatsAppMediaUrl(mediaId: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH_API}/${mediaId}`, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
    });
    const data = await res.json();
    return data.url || null;
  } catch {
    console.error("Failed to get media URL for:", mediaId);
    return null;
  }
}

export async function downloadWhatsAppMedia(mediaUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
    });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    console.error("Failed to download media");
    return null;
  }
}

// Mark a message as read
export async function markMessageAsRead(messageId: string) {
  const res = await fetch(`${GRAPH_API}/${getPhoneId()}/messages`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });
  return res.json();
}
