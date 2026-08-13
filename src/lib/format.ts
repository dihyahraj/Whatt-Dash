// ============================================================
// WHATT-DASH: pure formatting helpers
// Extracted from the dashboard component so they are defined once
// at module level instead of being re-created on every render.
// ============================================================

import type { ConversationWithLastMessage, MessageType } from "@/lib/types";

/** Sidebar timestamp: time today, "Yesterday", weekday, then date. */
export function ft(d: string): string {
  const t = new Date(d);
  const n = new Date();
  const df = n.getTime() - t.getTime();
  if (df < 86400000 && t.getDate() === n.getDate()) {
    return t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (df < 172800000) return "Yesterday";
  if (df < 604800000) return t.toLocaleDateString([], { weekday: "short" });
  return t.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Message bubble timestamp. */
export function mt(d: string): string {
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Avatar initials from a name, falling back to the last 2 phone digits. */
export function ini(n: string | null, p: string): string {
  if (n) {
    const sp = n.trim().split(/\s+/);
    return sp.length >= 2 ? (sp[0][0] + sp[1][0]).toUpperCase() : n.slice(0, 2).toUpperCase();
  }
  return p.slice(-2);
}

export const AVATAR_COLORS = [
  "from-emerald-400 to-teal-600",
  "from-blue-400 to-indigo-600",
  "from-purple-400 to-violet-600",
  "from-orange-400 to-red-600",
  "from-pink-400 to-rose-600",
  "from-cyan-400 to-blue-600",
  "from-amber-400 to-orange-600",
  "from-lime-400 to-green-600",
];

/** Stable gradient per conversation id. */
export function aclr(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/** Date separator label inside a chat. */
export function dl(d: string): string {
  const t = new Date(d);
  const n = new Date();
  if (t.toDateString() === n.toDateString()) return "Today";
  const y = new Date(n);
  y.setDate(y.getDate() - 1);
  if (t.toDateString() === y.toDateString()) return "Yesterday";
  return t.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

const TYPE_PREVIEW: Partial<Record<MessageType, string>> = {
  image: "📷 Photo",
  video: "🎥 Video",
  audio: "🎵 Audio",
  document: "📄 Document",
  sticker: "🏷️ Sticker",
  location: "📍 Location",
  contacts: "📇 Contact",
};

/** Sidebar last-message preview line. */
export function lmp(c: ConversationWithLastMessage): string {
  const prefix = c.last_message_role === "assistant" ? "✓ " : "";
  if (c.last_message_type && c.last_message_type !== "text" && TYPE_PREVIEW[c.last_message_type]) {
    return prefix + TYPE_PREVIEW[c.last_message_type];
  }
  return prefix + (c.last_message || "");
}
