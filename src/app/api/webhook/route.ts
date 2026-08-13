import { after, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { downloadAndStoreMedia } from "@/lib/media-storage";

/**
 * WhatsApp Cloud API webhook.
 *
 * Two things changed here for speed and reliability:
 *
 * 1. Media no longer blocks the response. Downloading a video from Meta and
 *    re-uploading it to Supabase Storage took seconds, and Meta retries any
 *    webhook that doesn't answer within ~5s (repeatedly, then disables it). The
 *    row is now inserted immediately with `media_url = null` — the dashboard
 *    already renders that as "Receiving photo…" — and `after()` fills the URL in
 *    once the response has been sent. Realtime pushes the update to open tabs.
 *
 * 2. The whole payload is processed. Meta may batch several entries/changes and
 *    several messages or statuses per delivery; the old code read only
 *    `entry[0].changes[0].value.messages[0]`, so everything else was silently
 *    dropped (returning 200 told Meta it was delivered — those messages were
 *    simply lost).
 */

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

/* eslint-disable @typescript-eslint/no-explicit-any */

type MediaJob = { rowId: string; mediaId: string; mimeType: string; filename?: string };

// A later status must never be overwritten by an earlier one arriving late.
const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };
const DOWNGRADE_GUARD: Record<string, string[]> = {
  delivered: ["sent"],
  read: ["sent", "delivered"],
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || body.object !== "whatsapp_business_account") {
    return Response.json({ status: "ignored" });
  }

  const values: any[] = (body.entry || [])
    .flatMap((entry: any) => entry?.changes || [])
    .map((change: any) => change?.value)
    .filter(Boolean);

  const statuses: any[] = values.flatMap((v) => v.statuses || []);
  const incoming = values.flatMap((v) =>
    (v.messages || []).map((message: any) => ({ message, contact: v.contacts?.[0] })),
  );

  try {
    if (statuses.length) await applyStatuses(statuses);
    if (!incoming.length) {
      return Response.json({ status: statuses.length ? "status_updated" : "no_message" });
    }

    // Group by sender so each conversation costs one lookup and one update
    // regardless of how many messages arrived in the batch.
    type Bucket = { name: string | null; messages: any[] };
    const byPhone = new Map<string, Bucket>();
    for (const { message, contact } of incoming) {
      const phone = message.from;
      if (!phone) continue;
      const bucket: Bucket =
        byPhone.get(phone) || { name: contact?.profile?.name || null, messages: [] };
      if (!bucket.name && contact?.profile?.name) bucket.name = contact.profile.name;
      bucket.messages.push(message);
      byPhone.set(phone, bucket);
    }

    const mediaJobs: MediaJob[] = [];
    for (const [phone, { name, messages }] of byPhone) {
      const jobs = await ingestConversation(phone, name, messages);
      mediaJobs.push(...jobs);
    }

    // Response goes out now; media is fetched afterwards.
    if (mediaJobs.length) {
      after(async () => {
        for (const job of mediaJobs) {
          try {
            const publicUrl = await downloadAndStoreMedia(job.mediaId, job.mimeType, job.filename);
            if (publicUrl) {
              await getSupabase().from("messages").update({ media_url: publicUrl }).eq("id", job.rowId);
            }
          } catch (error) {
            console.error("[webhook] media backfill failed:", job.mediaId, error);
          }
        }
      });
    }

    return Response.json({ status: "stored", messages: incoming.length });
  } catch (error) {
    console.error("Webhook error:", error);
    return Response.json({ status: "error" }, { status: 500 });
  }
}

/** Apply delivery receipts in rank order, batched by status value. */
async function applyStatuses(statuses: any[]) {
  const supabase = getSupabase();

  // Keep only the furthest status per message id.
  const best = new Map<string, string>();
  for (const s of statuses) {
    if (!s?.id || !s?.status) continue;
    const current = best.get(s.id);
    if (!current || (STATUS_RANK[s.status] || 0) > (STATUS_RANK[current] || 0)) best.set(s.id, s.status);
  }

  const groups = new Map<string, string[]>();
  for (const [msgId, status] of best) {
    const ids = groups.get(status);
    if (ids) ids.push(msgId);
    else groups.set(status, [msgId]);
  }

  const ordered = [...groups.entries()].sort(
    (a, b) => (STATUS_RANK[a[0]] || 0) - (STATUS_RANK[b[0]] || 0),
  );

  for (const [status, ids] of ordered) {
    let query = supabase.from("messages").update({ status }).in("whatsapp_msg_id", ids);
    const allowedPrevious = DOWNGRADE_GUARD[status];
    if (allowedPrevious) query = query.in("status", allowedPrevious);
    await query;
  }
}

/** Insert every message of one sender, then update the conversation once. */
async function ingestConversation(
  phone: string,
  name: string | null,
  messages: any[],
): Promise<MediaJob[]> {
  const supabase = getSupabase();

  let { data: conversation } = await supabase
    .from("conversations")
    .select("id, name, unread_count")
    .eq("phone", phone)
    .maybeSingle();

  if (!conversation) {
    const { data: created } = await supabase
      .from("conversations")
      .insert({ phone, name })
      .select("id, name, unread_count")
      .single();
    conversation = created;
  }
  if (!conversation) return [];

  const rows: Record<string, any>[] = [];
  const pendingMedia = new Map<string, { mediaId: string; mimeType: string; filename?: string }>();

  for (const message of messages) {
    // Reactions mutate an existing message instead of adding one.
    if (message.type === "reaction" && message.reaction) {
      const { data: target } = await supabase
        .from("messages")
        .select("id")
        .eq("whatsapp_msg_id", message.reaction.message_id)
        .maybeSingle();
      if (target) {
        await supabase.from("messages").update({ reaction: message.reaction.emoji }).eq("id", target.id);
      }
      continue;
    }

    const rec: Record<string, any> = {
      conversation_id: conversation.id,
      role: "user",
      content: "",
      message_type: message.type,
      whatsapp_msg_id: message.id,
    };

    if (message.context?.id) {
      const { data: repliedTo } = await supabase
        .from("messages")
        .select("id")
        .eq("whatsapp_msg_id", message.context.id)
        .maybeSingle();
      if (repliedTo) rec.reply_to_id = repliedTo.id;
    }

    const media = fillMessageFields(rec, message);
    if (media && message.id) pendingMedia.set(message.id, media);
    rows.push(rec);
  }

  if (!rows.length) {
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id);
    return [];
  }

  if (name && name !== conversation.name) {
    await supabase.from("conversations").update({ name }).eq("id", conversation.id);
  }

  // ON CONFLICT DO NOTHING on the unique whatsapp_msg_id: a Meta retry inserts
  // nothing and returns nothing, so media is never downloaded twice.
  const { data: inserted, error: insertError } = await supabase
    .from("messages")
    .upsert(rows, { onConflict: "whatsapp_msg_id", ignoreDuplicates: true })
    .select("id, whatsapp_msg_id");

  if (insertError) {
    console.error("Insert error:", insertError);
    return [];
  }
  if (!inserted?.length) return []; // pure duplicate delivery

  const last = rows[rows.length - 1];

  // Atomic increment in SQL. Reading unread_count and adding to it in JS loses
  // increments when two inbound webhooks for the same chat overlap (which Meta's
  // retries make likely). Falls back to the old read-modify-write if the
  // migration that adds the function hasn't been applied yet.
  const { error: bumpError } = await supabase.rpc("bump_conversation_inbound", {
    p_id: conversation.id,
    p_count: inserted.length,
    p_last_message: last.content,
    p_last_message_type: last.message_type || "text",
  });

  if (bumpError) {
    const now = new Date().toISOString();
    await supabase
      .from("conversations")
      .update({
        updated_at: now,
        unread_count: (conversation.unread_count || 0) + inserted.length,
        last_message: last.content,
        last_message_type: last.message_type || "text",
        last_message_role: "user",
        last_message_time: now,
      })
      .eq("id", conversation.id);
  }

  const jobs: MediaJob[] = [];
  for (const row of inserted) {
    const media = row.whatsapp_msg_id ? pendingMedia.get(row.whatsapp_msg_id) : undefined;
    if (media) jobs.push({ rowId: row.id, ...media });
  }
  return jobs;
}

/**
 * Fill `rec` from the WhatsApp message body. Returns a media descriptor when the
 * message carries a file that still has to be fetched from Meta.
 */
function fillMessageFields(
  rec: Record<string, any>,
  message: any,
): { mediaId: string; mimeType: string; filename?: string } | null {
  switch (message.type) {
    case "text":
      rec.content = message.text?.body || "";
      return null;

    case "image":
    case "video":
    case "audio":
    case "sticker": {
      const media = message[message.type];
      if (!media) return null;
      rec.media_url = null; // backfilled by after()
      rec.media_mime_type = media.mime_type;
      rec.media_sha256 = media.sha256 || null;
      rec.media_caption = media.caption || null;
      rec.content = media.caption || `[${message.type}]`;
      return media.id ? { mediaId: media.id, mimeType: media.mime_type } : null;
    }

    case "document": {
      const doc = message.document;
      if (!doc) return null;
      rec.media_url = null;
      rec.media_mime_type = doc.mime_type;
      rec.media_filename = doc.filename || null;
      rec.media_sha256 = doc.sha256 || null;
      rec.media_caption = doc.caption || null;
      rec.content = doc.caption || doc.filename || "[document]";
      return doc.id ? { mediaId: doc.id, mimeType: doc.mime_type, filename: doc.filename } : null;
    }

    case "location": {
      const loc = message.location;
      if (!loc) return null;
      rec.latitude = loc.latitude;
      rec.longitude = loc.longitude;
      rec.location_name = loc.name || null;
      rec.location_address = loc.address || null;
      rec.content = loc.name || loc.address || `📍 ${loc.latitude}, ${loc.longitude}`;
      return null;
    }

    case "contacts": {
      const contacts = message.contacts;
      if (!contacts?.length) return null;
      rec.content = `📇 Contact: ${contacts
        .map((c: { name: { formatted_name: string } }) => c.name.formatted_name)
        .join(", ")}`;
      rec.media_caption = JSON.stringify(contacts);
      return null;
    }

    case "interactive": {
      const inter = message.interactive;
      if (inter?.type === "button_reply") rec.content = `📊 ${inter.button_reply?.title || "Button reply"}`;
      else if (inter?.type === "list_reply") rec.content = `📋 ${inter.list_reply?.title || "List reply"}`;
      else rec.content = `[interactive: ${inter?.type || "unknown"}]`;
      rec.message_type = "text";
      return null;
    }

    case "button":
      rec.content = `📊 ${message.button?.text || "Button response"}`;
      rec.message_type = "text";
      return null;

    default:
      rec.content = `[${message.type} message]`;
      rec.message_type = "text";
      return null;
  }
}
