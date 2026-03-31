// ============================================================
// WHATT-DASH: Enhanced Types
// ============================================================

export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "location"
  | "contacts"
  | "reaction"
  | "poll"
  | "unknown";

export type MessageStatus = "sent" | "delivered" | "read" | "failed";

export interface Conversation {
  id: string;
  phone: string;
  name: string | null;
  profile_pic_url: string | null;
  is_pinned: boolean;
  is_muted: boolean;
  is_archived: boolean;
  unread_count: number;
  updated_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  message_type: MessageType;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  media_caption: string | null;
  media_sha256: string | null;
  reply_to_id: string | null;
  reaction: string | null;
  reaction_msg_id: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  location_address: string | null;
  whatsapp_msg_id: string | null;
  is_deleted: boolean;
  is_starred: boolean;
  status: MessageStatus;
  created_at: string;
}

export interface ConversationWithLastMessage extends Conversation {
  last_message: string | null;
  last_message_type: MessageType | null;
  last_message_role: "user" | "assistant" | null;
  last_message_time: string | null;
}

// WhatsApp Cloud API webhook payload types
export interface WhatsAppWebhookBody {
  object: string;
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  value: WhatsAppValue;
  field: string;
}

export interface WhatsAppValue {
  messaging_product: string;
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

export interface WhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: WhatsAppMedia;
  video?: WhatsAppMedia;
  audio?: WhatsAppMedia;
  document?: WhatsAppMedia & { filename?: string };
  sticker?: WhatsAppMedia;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: WhatsAppContactCard[];
  reaction?: { message_id: string; emoji: string };
  context?: { from: string; id: string };
}

export interface WhatsAppMedia {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
}

export interface WhatsAppContactCard {
  name: { formatted_name: string; first_name?: string; last_name?: string };
  phones?: { phone: string; type?: string }[];
}

export interface WhatsAppStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: { code: number; title: string }[];
}
