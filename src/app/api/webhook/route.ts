import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getWhatsAppMediaUrl } from "@/lib/whatsapp";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.object !== "whatsapp_business_account") {
    return Response.json({ status: "ignored" });
  }

  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  // Handle status updates (sent/delivered/read)
  if (value?.statuses?.[0]) {
    const statusUpdate = value.statuses[0];
    try {
      await supabase
        .from("messages")
        .update({ status: statusUpdate.status })
        .eq("whatsapp_msg_id", statusUpdate.id);
    } catch (e) {
      console.error("Status update error:", e);
    }
    return Response.json({ status: "status_updated" });
  }

  // Only process actual messages
  if (!value?.messages?.[0]) {
    return Response.json({ status: "no_message" });
  }

  const message = value.messages[0];
  const contact = value.contacts?.[0];
  const phone = message.from;
  const name = contact?.profile?.name || null;
  const whatsappMsgId = message.id;
  const msgType = message.type;

  try {
    // Find or create conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("phone", phone)
      .single();

    if (!conversation) {
      const { data: newConvo } = await supabase
        .from("conversations")
        .insert({ phone, name, unread_count: 1 })
        .select()
        .single();
      conversation = newConvo;
    } else {
      // Update name + increment unread
      await supabase
        .from("conversations")
        .update({
          ...(name && name !== conversation.name ? { name } : {}),
          unread_count: (conversation.unread_count || 0) + 1,
        })
        .eq("id", conversation.id);
    }

    if (!conversation) {
      return Response.json({ error: "Failed to create conversation" }, { status: 500 });
    }

    // Build message record based on type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msgRecord: Record<string, any> = {
      conversation_id: conversation.id,
      role: "user",
      content: "",
      message_type: msgType,
      whatsapp_msg_id: whatsappMsgId,
    };

    // Handle reply context
    if (message.context?.id) {
      // Find the original message in our DB
      const { data: replyMsg } = await supabase
        .from("messages")
        .select("id")
        .eq("whatsapp_msg_id", message.context.id)
        .single();
      if (replyMsg) {
        msgRecord.reply_to_id = replyMsg.id;
      }
    }

    switch (msgType) {
      case "text":
        msgRecord.content = message.text?.body || "";
        break;

      case "image":
      case "video":
      case "audio":
      case "sticker": {
        const media = message[msgType as "image" | "video" | "audio" | "sticker"];
        if (media) {
          const mediaUrl = await getWhatsAppMediaUrl(media.id);
          msgRecord.media_url = mediaUrl;
          msgRecord.media_mime_type = media.mime_type;
          msgRecord.media_sha256 = media.sha256 || null;
          msgRecord.media_caption = media.caption || null;
          msgRecord.content = media.caption || `[${msgType}]`;
        }
        break;
      }

      case "document": {
        const doc = message.document;
        if (doc) {
          const mediaUrl = await getWhatsAppMediaUrl(doc.id);
          msgRecord.media_url = mediaUrl;
          msgRecord.media_mime_type = doc.mime_type;
          msgRecord.media_filename = doc.filename || null;
          msgRecord.media_sha256 = doc.sha256 || null;
          msgRecord.media_caption = doc.caption || null;
          msgRecord.content = doc.caption || doc.filename || "[document]";
        }
        break;
      }

      case "location": {
        const loc = message.location;
        if (loc) {
          msgRecord.latitude = loc.latitude;
          msgRecord.longitude = loc.longitude;
          msgRecord.location_name = loc.name || null;
          msgRecord.location_address = loc.address || null;
          msgRecord.content = loc.name || loc.address || `📍 Location: ${loc.latitude}, ${loc.longitude}`;
        }
        break;
      }

      case "contacts": {
        const contacts = message.contacts;
        if (contacts && contacts.length > 0) {
          const contactNames = contacts.map((c: { name: { formatted_name: string } }) => c.name.formatted_name).join(", ");
          msgRecord.content = `📇 Contact: ${contactNames}`;
          // Store full contact data in content as JSON
          msgRecord.media_caption = JSON.stringify(contacts);
        }
        break;
      }

      case "reaction": {
        const reaction = message.reaction;
        if (reaction) {
          // Find the message being reacted to
          const { data: reactedMsg } = await supabase
            .from("messages")
            .select("id")
            .eq("whatsapp_msg_id", reaction.message_id)
            .single();
          
          if (reactedMsg) {
            // Update the reacted message with the reaction
            await supabase
              .from("messages")
              .update({ reaction: reaction.emoji })
              .eq("id", reactedMsg.id);
          }
          // Don't store reaction as a separate message
          // Update conversation timestamp
          await supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversation.id);
          return Response.json({ status: "reaction_stored" });
        }
        break;
      }

      default:
        msgRecord.content = `[${msgType} message - not supported yet]`;
        msgRecord.message_type = "unknown";
        break;
    }

    // Store message (ignore duplicates)
    const { error: insertError } = await supabase.from("messages").insert(msgRecord);

    if (insertError?.code === "23505") {
      return Response.json({ status: "duplicate" });
    }

    if (insertError) {
      console.error("Insert error:", insertError);
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id);

    return Response.json({ status: "stored" });
  } catch (error) {
    console.error("Webhook error:", error);
    return Response.json({ status: "error" }, { status: 500 });
  }
}
