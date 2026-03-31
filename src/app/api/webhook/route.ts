import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { downloadAndStoreMedia } from "@/lib/media-storage";

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
  if (body.object !== "whatsapp_business_account") return Response.json({ status: "ignored" });

  const value = body.entry?.[0]?.changes?.[0]?.value;

  // Status updates
  if (value?.statuses?.[0]) {
    const s = value.statuses[0];
    await supabase.from("messages").update({ status: s.status }).eq("whatsapp_msg_id", s.id);
    return Response.json({ status: "status_updated" });
  }

  if (!value?.messages?.[0]) return Response.json({ status: "no_message" });

  const message = value.messages[0];
  const contact = value.contacts?.[0];
  const phone = message.from;
  const name = contact?.profile?.name || null;
  const whatsappMsgId = message.id;
  const msgType = message.type;

  try {
    // Find or create conversation
    let { data: conversation } = await supabase.from("conversations").select("*").eq("phone", phone).single();

    if (!conversation) {
      const { data: newConvo } = await supabase.from("conversations").insert({ phone, name, unread_count: 1 }).select().single();
      conversation = newConvo;
    } else {
      await supabase.from("conversations").update({
        ...(name && name !== conversation.name ? { name } : {}),
        unread_count: (conversation.unread_count || 0) + 1,
      }).eq("id", conversation.id);
    }

    if (!conversation) return Response.json({ error: "Failed to create conversation" }, { status: 500 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: Record<string, any> = {
      conversation_id: conversation.id,
      role: "user",
      content: "",
      message_type: msgType,
      whatsapp_msg_id: whatsappMsgId,
    };

    // Reply context
    if (message.context?.id) {
      const { data: rm } = await supabase.from("messages").select("id").eq("whatsapp_msg_id", message.context.id).single();
      if (rm) rec.reply_to_id = rm.id;
    }

    switch (msgType) {
      case "text":
        rec.content = message.text?.body || "";
        break;

      case "image":
      case "video":
      case "audio":
      case "sticker": {
        const media = message[msgType as "image" | "video" | "audio" | "sticker"];
        if (media) {
          // Download immediately and store in Supabase Storage
          const publicUrl = await downloadAndStoreMedia(media.id, media.mime_type);
          rec.media_url = publicUrl; // permanent public URL (or null if failed)
          rec.media_mime_type = media.mime_type;
          rec.media_sha256 = media.sha256 || null;
          rec.media_caption = media.caption || null;
          rec.content = media.caption || `[${msgType}]`;
        }
        break;
      }

      case "document": {
        const doc = message.document;
        if (doc) {
          const publicUrl = await downloadAndStoreMedia(doc.id, doc.mime_type, doc.filename);
          rec.media_url = publicUrl;
          rec.media_mime_type = doc.mime_type;
          rec.media_filename = doc.filename || null;
          rec.media_sha256 = doc.sha256 || null;
          rec.media_caption = doc.caption || null;
          rec.content = doc.caption || doc.filename || "[document]";
        }
        break;
      }

      case "location": {
        const loc = message.location;
        if (loc) {
          rec.latitude = loc.latitude;
          rec.longitude = loc.longitude;
          rec.location_name = loc.name || null;
          rec.location_address = loc.address || null;
          rec.content = loc.name || loc.address || `📍 ${loc.latitude}, ${loc.longitude}`;
        }
        break;
      }

      case "contacts": {
        const contacts = message.contacts;
        if (contacts?.length > 0) {
          const names = contacts.map((c: { name: { formatted_name: string } }) => c.name.formatted_name).join(", ");
          rec.content = `📇 Contact: ${names}`;
          rec.media_caption = JSON.stringify(contacts);
        }
        break;
      }

      case "reaction": {
        const reaction = message.reaction;
        if (reaction) {
          const { data: rm } = await supabase.from("messages").select("id").eq("whatsapp_msg_id", reaction.message_id).single();
          if (rm) await supabase.from("messages").update({ reaction: reaction.emoji }).eq("id", rm.id);
          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversation.id);
          return Response.json({ status: "reaction_stored" });
        }
        break;
      }

      case "interactive": {
        const inter = message.interactive;
        if (inter?.type === "button_reply") {
          rec.content = `📊 ${inter.button_reply?.title || "Button reply"}`;
        } else if (inter?.type === "list_reply") {
          rec.content = `📋 ${inter.list_reply?.title || "List reply"}`;
        } else {
          rec.content = `[interactive: ${inter?.type || "unknown"}]`;
        }
        rec.message_type = "text";
        break;
      }

      case "button":
        rec.content = `📊 ${message.button?.text || "Button response"}`;
        rec.message_type = "text";
        break;

      default:
        rec.content = `[${msgType} message]`;
        rec.message_type = "text";
        break;
    }

    const { error: insertError } = await supabase.from("messages").insert(rec);
    if (insertError?.code === "23505") return Response.json({ status: "duplicate" });
    if (insertError) {
      console.error("Insert error:", insertError);
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversation.id);
    return Response.json({ status: "stored" });
  } catch (error) {
    console.error("Webhook error:", error);
    return Response.json({ status: "error" }, { status: 500 });
  }
}
