"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import type { ConversationWithLastMessage, Message, MessageType } from "@/lib/types";

const EMOJI_CATEGORIES: Record<string, string[]> = {
  "😀": ["😀","😃","😄","😁","😅","😂","🤣","😊","😇","🙂","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🫡","🤭","🫢","🫣","🤫","🤥","😶","🫥","😐","🫤","😑","🫠","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🫨","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾"],
  "👋": ["👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄","🫦"],
  "❤️": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","💕","💞","💓","💗","💖","💘","💝","💟","♥️","🩷","🩵","🩶"],
  "🎉": ["🎉","🎊","🎈","🎁","🎀","🏆","🥇","🥈","🥉","⚽","🏀","🏈","⚾","🎾","🏐","🎯","🔥","⭐","🌟","✨","💫","🌈","☀️","🌙","💡","🔔","📌","📍","🗝️","🔑","💰","💵","💎","📱","💻","⌚","📷","🎵","🎶","🎤","🎧","🎸","🎹","🎺","🥁","🎬","📺","📻","📚","📖","📝","✏️","📎","📐","✂️"],
  "🍔": ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🥐","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘"],
  "🐶": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪰","🪲","🪳","🦟","🦗","🕷️","🦂","🐢","🐍","🦎","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈"],
};

const QUICK_REACTIONS = ["👍","❤️","😂","😮","😢","🙏","🔥","🎉"];

export default function Dashboard() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
  }, []);

  const [conversations, setConversations] = useState<ConversationWithLastMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [chatMenu, setChatMenu] = useState<string | null>(null);
  const [msgMenu, setMsgMenu] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(Object.keys(EMOJI_CATEGORIES)[0]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = conversations.find((c) => c.id === selectedId);

  const fetchConversations = useCallback(async () => {
    try { const res = await fetch("/api/conversations"); const data = await res.json(); if (Array.isArray(data)) setConversations(data); } catch (e) { console.error(e); }
  }, []);
  const fetchMessages = useCallback(async (convoId: string) => {
    try { const res = await fetch(`/api/conversations/${convoId}/messages`); const data = await res.json(); if (Array.isArray(data)) setMessages(data); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  useEffect(() => {
    if (selectedId) { fetchMessages(selectedId); fetch(`/api/conversations/${selectedId}/read`, { method: "POST" }).catch(() => {}); setConversations((p) => p.map((c) => c.id === selectedId ? { ...c, unread_count: 0 } : c)); }
  }, [selectedId, fetchMessages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Polling every 3s
  useEffect(() => {
    const iv = setInterval(() => { fetchConversations(); if (selectedId) fetchMessages(selectedId); }, 3000);
    return () => clearInterval(iv);
  }, [fetchConversations, fetchMessages, selectedId]);

  // Realtime bonus
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel("rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as Message;
        if (m.conversation_id === selectedId) setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
        if (m.role === "user" && m.conversation_id !== selectedId && "Notification" in window && Notification.permission === "granted") {
          const c = conversations.find((x) => x.id === m.conversation_id);
          new Notification(c?.name || c?.phone || "New Message", { body: m.content?.substring(0, 80) || "New message", icon: "/favicon.ico" });
        }
        fetchConversations();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (p) => { const u = p.new as Message; setMessages((prev) => prev.map((m) => m.id === u.id ? u : m)); })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => fetchConversations())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedId, fetchConversations, supabase]);

  useEffect(() => { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); }, []);

  // Actions
  async function handleSend() {
    if (!input.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      const b: Record<string, string> = { message: input.trim() };
      if (replyTo) { b.replyToMsgId = replyTo.id; if (replyTo.whatsapp_msg_id) b.replyToWhatsappId = replyTo.whatsapp_msg_id; }
      const res = await fetch(`/api/conversations/${selectedId}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
      if (!res.ok) { const d = await res.json(); alert("Error:\n" + JSON.stringify(d, null, 2)); return; }
      setInput(""); setReplyTo(null); fetchMessages(selectedId);
    } catch (err) { alert("Network Error: " + String(err)); }
    finally { setSending(false); }
  }

  const closeAll = () => { setChatMenu(null); setMsgMenu(null); setShowReactionPicker(null); setShowEmojiPicker(false); setHeaderMenu(false); };
  async function handlePin(id: string, v: boolean) { await fetch(`/api/conversations/${id}/pin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: v }) }); fetchConversations(); closeAll(); }
  async function handleMute(id: string, v: boolean) { await fetch(`/api/conversations/${id}/mute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ muted: v }) }); fetchConversations(); closeAll(); }
  async function handleMarkUnread(id: string) { await fetch(`/api/conversations/${id}/unread`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unread_count: 1 }) }); fetchConversations(); closeAll(); }
  async function handleArchive(id: string) { await fetch(`/api/conversations/${id}/archive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: true }) }); if (selectedId === id) { setSelectedId(null); setMessages([]); } fetchConversations(); closeAll(); }
  async function handleDeleteChat(id: string) { if (!confirm("Puri chat delete hogi, undo nahi hoga!")) return; await fetch(`/api/conversations/${id}/delete`, { method: "POST" }); if (selectedId === id) { setSelectedId(null); setMessages([]); } fetchConversations(); closeAll(); }
  async function handleDeleteMsg(id: string) { await fetch(`/api/messages/${id}/delete`, { method: "POST" }); setMessages((p) => p.map((m) => m.id === id ? { ...m, is_deleted: true, content: "🚫 This message was deleted" } : m)); setMsgMenu(null); }
  async function handleStarMsg(id: string, v: boolean) { await fetch(`/api/messages/${id}/star`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starred: v }) }); setMessages((p) => p.map((m) => m.id === id ? { ...m, is_starred: v } : m)); setMsgMenu(null); }
  async function handleReact(msgId: string, emoji: string) {
    if (!selectedId) return;
    const msg = messages.find((m) => m.id === msgId);
    await fetch(`/api/conversations/${selectedId}/react`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: msgId, emoji, whatsappMsgId: msg?.whatsapp_msg_id || null }) });
    setMessages((p) => p.map((m) => m.id === msgId ? { ...m, reaction: emoji } : m));
    setShowReactionPicker(null);
  }

  useEffect(() => { document.addEventListener("click", closeAll); return () => document.removeEventListener("click", closeAll); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setReplyTo(null); closeAll(); setImagePreview(null); }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setShowSearch((p) => !p); }
    };
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h);
  }, []);

  // Helpers
  function fmtTime(d: string) { const t = new Date(d), n = new Date(), diff = n.getTime() - t.getTime(); if (diff < 86400000 && t.getDate() === n.getDate()) return t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); if (diff < 172800000) return "Yesterday"; if (diff < 604800000) return t.toLocaleDateString([], { weekday: "short" }); return t.toLocaleDateString([], { month: "short", day: "numeric" }); }
  function fmtMsgTime(d: string) { return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  function initials(name: string | null, phone: string) { if (name) { const p = name.trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase(); } return phone.slice(-2); }
  function avatarColor(id: string) { const c = ["from-emerald-500 to-teal-700","from-blue-500 to-indigo-700","from-purple-500 to-violet-700","from-orange-500 to-red-700","from-pink-500 to-rose-700","from-cyan-500 to-blue-700","from-amber-500 to-orange-700","from-lime-500 to-green-700"]; let h = 0; for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h); return c[Math.abs(h) % c.length]; }
  function lastMsgPreview(c: ConversationWithLastMessage) { const p = c.last_message_role === "assistant" ? "✓ You: " : ""; const ic: Partial<Record<MessageType, string>> = { image: "📷 Photo", video: "🎥 Video", audio: "🎵 Audio", document: "📄 Document", sticker: "🏷️ Sticker", location: "📍 Location", contacts: "📇 Contact" }; if (c.last_message_type && c.last_message_type !== "text" && ic[c.last_message_type]) return p + ic[c.last_message_type]; return p + (c.last_message || ""); }
  function statusIcon(s: string) {
    if (s === "sent") return <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="inline ml-1"><path d="M11 1L4.5 8.5L1 5.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    if (s === "delivered") return <svg width="20" height="11" viewBox="0 0 20 11" fill="none" className="inline ml-1"><path d="M7 1L1.5 7.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 1L7.5 8.5L5 6" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    if (s === "read") return <svg width="20" height="11" viewBox="0 0 20 11" fill="none" className="inline ml-1"><path d="M7 1L1.5 7.5" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 1L7.5 8.5L5 6" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    return null;
  }
  function dateLabel(d: string) { const t = new Date(d), n = new Date(); if (t.toDateString() === n.toDateString()) return "Today"; const y = new Date(n); y.setDate(y.getDate()-1); if (t.toDateString() === y.toDateString()) return "Yesterday"; return t.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }
  function showDateSep(msgs: Message[], i: number) { return i === 0 || new Date(msgs[i].created_at).toDateString() !== new Date(msgs[i-1].created_at).toDateString(); }

  const filtered = conversations.filter((c) => { if (!searchQuery) return true; const q = searchQuery.toLowerCase(); return c.name?.toLowerCase().includes(q) || c.phone.includes(q) || c.last_message?.toLowerCase().includes(q); });

  // ─── Media Renderer ───────────────────────────────────────
  function renderMedia(msg: Message) {
    if (msg.is_deleted) return <p className="italic text-white/40 text-[13px]">🚫 This message was deleted</p>;

    switch (msg.message_type) {
      case "image":
        return (
          <div>
            {msg.media_url && (
              <img src={msg.media_url} alt="Photo" className="rounded-md max-w-[260px] max-h-[300px] object-cover cursor-pointer hover:brightness-90 transition" onClick={() => setImagePreview(msg.media_url)} onError={(e) => { (e.target as HTMLImageElement).alt = "Failed to load image"; }}/>
            )}
            {msg.media_caption && msg.media_caption !== "[image]" && <p className="text-[13px] mt-1.5 whitespace-pre-wrap">{msg.media_caption}</p>}
          </div>
        );

      case "video":
        return (
          <div>
            {msg.media_url ? (
              <video controls className="rounded-md max-w-[260px]" preload="metadata">
                <source src={msg.media_url} type={msg.media_mime_type || "video/mp4"}/>
              </video>
            ) : <span className="text-[13px]">🎥 Video</span>}
            {msg.media_caption && <p className="text-[13px] mt-1.5">{msg.media_caption}</p>}
          </div>
        );

      case "audio":
        return msg.media_url ? <audio controls className="max-w-[240px]" preload="metadata"><source src={msg.media_url} type={msg.media_mime_type || "audio/ogg"}/></audio> : <span className="text-[13px]">🎵 Voice</span>;

      case "document":
        return (
          <a href={msg.media_url || "#"} target="_blank" rel="noreferrer" download={msg.media_filename || "document"} className="flex items-center gap-2.5 bg-white/[0.06] hover:bg-white/[0.10] transition rounded-lg p-3 min-w-[200px] cursor-pointer">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">📄</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate text-white">{msg.media_filename || "Document"}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{msg.media_mime_type || "File"} • Tap to download</p>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="flex-shrink-0 opacity-50"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </a>
        );

      case "sticker":
        return msg.media_url ? <img src={msg.media_url} alt="Sticker" className="w-[120px] h-[120px] object-contain"/> : <span className="text-4xl">🏷️</span>;

      case "location":
        return (
          <a href={`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`} target="_blank" rel="noreferrer" className="block bg-white/[0.06] hover:bg-white/[0.10] transition rounded-lg p-3 min-w-[180px]">
            <p className="text-[13px] font-medium">📍 {msg.location_name || "Location"}</p>
            {msg.location_address && <p className="text-[11px] text-white/40 mt-0.5">{msg.location_address}</p>}
            <p className="text-[11px] text-emerald-400 mt-1">Tap to open in Maps →</p>
          </a>
        );

      default:
        return <p className="text-[13px] whitespace-pre-wrap break-words leading-[1.45]">{msg.content}</p>;
    }
  }

  // ─── ThreeDot Component ───────────────────────────────────
  const ThreeDot = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
  );

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex h-screen bg-[#0b0b0b] overflow-hidden select-none" style={{ fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif" }}>

      {/* ═══ SIDEBAR ═══ */}
      <div className="w-[340px] flex flex-col border-r border-white/[0.06] flex-shrink-0" style={{ background: "#111" }}>
        {/* Header */}
        <div className="px-4 pt-3.5 pb-2.5 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.632.632l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.379 0-4.588-.813-6.334-2.176l-.442-.352-3.17 1.063 1.063-3.17-.352-.442A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
              </div>
              <div><h1 className="text-[14px] font-bold text-white">Whatt Dash</h1><p className="text-[11px] text-white/35">{conversations.length} chat{conversations.length !== 1 ? "s" : ""}</p></div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setShowSearch(!showSearch); }} className="w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
          </div>
          {showSearch && <div className="relative mt-2.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search chats..." className="w-full bg-white/[0.05] rounded-lg pl-9 pr-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:outline-none border border-white/[0.06]" autoFocus/></div>}
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <div className="flex flex-col items-center justify-center h-48 gap-2 text-white/25 text-xs">{searchQuery ? "No results" : "No conversations yet"}</div>}
          {filtered.map((convo) => {
            const sel = selectedId === convo.id;
            return (
              <div key={convo.id} className={`relative group ${sel ? "bg-[#2a3942]" : "hover:bg-white/[0.03]"}`}>
                <button onClick={() => { setSelectedId(convo.id); closeAll(); }} className="w-full text-left px-3 py-3 flex items-center gap-3">
                  <div className={`w-[48px] h-[48px] rounded-full bg-gradient-to-br ${avatarColor(convo.id)} flex items-center justify-center flex-shrink-0 text-white text-[14px] font-bold`}>{initials(convo.name, convo.phone)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[14px] truncate ${convo.unread_count > 0 ? "font-bold text-white" : "font-medium text-white/80"}`}>{convo.name || convo.phone}</span>
                      <span className={`text-[11px] flex-shrink-0 ${convo.unread_count > 0 ? "text-emerald-400 font-semibold" : "text-white/30"}`}>{fmtTime(convo.last_message_time || convo.updated_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={`text-[12px] truncate ${convo.unread_count > 0 ? "text-white/60" : "text-white/35"}`}>{lastMsgPreview(convo)}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {convo.is_pinned && <span className="text-[10px]">📌</span>}
                        {convo.is_muted && <span className="text-[10px]">🔕</span>}
                        {convo.unread_count > 0 && <span className="min-w-[18px] h-[18px] rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center px-1">{convo.unread_count}</span>}
                      </div>
                    </div>
                  </div>
                </button>
                {/* 3-dot on hover */}
                <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); setChatMenu(chatMenu === convo.id ? null : convo.id); setMsgMenu(null); setHeaderMenu(false); }} className="w-7 h-7 rounded-full hover:bg-white/[0.12] flex items-center justify-center text-white/50"><ThreeDot/></button>
                </div>
                {chatMenu === convo.id && (
                  <div className="absolute right-3 top-10 z-50 bg-[#233138] rounded-xl shadow-2xl py-1.5 min-w-[190px] border border-white/[0.1]" onClick={(e) => e.stopPropagation()}>
                    <MI i="📌" l={convo.is_pinned ? "Unpin chat" : "Pin chat"} o={() => handlePin(convo.id, !convo.is_pinned)}/>
                    <MI i={convo.is_muted ? "🔔" : "🔕"} l={convo.is_muted ? "Unmute" : "Mute"} o={() => handleMute(convo.id, !convo.is_muted)}/>
                    <MI i="📩" l="Mark as unread" o={() => handleMarkUnread(convo.id)}/>
                    <MI i="📦" l="Archive" o={() => handleArchive(convo.id)}/>
                    <div className="h-px bg-white/[0.06] my-1"/>
                    <MI i="🗑️" l="Delete chat" o={() => handleDeleteChat(convo.id)} d/>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ CHAT ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: "radial-gradient(ellipse at center, rgba(16,185,129,0.03) 0%, #0b0b0b 70%)" }}>
            <div className="w-20 h-20 rounded-3xl bg-white/[0.03] flex items-center justify-center border border-white/[0.06]"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
            <div className="text-center"><p className="text-[15px] font-semibold text-white/25">Whatt Dash</p><p className="text-[12px] text-white/15 mt-1">Select a conversation</p></div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between" style={{ background: "#202c33" }}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(selected.id)} flex items-center justify-center text-white text-sm font-bold`}>{initials(selected.name, selected.phone)}</div>
                <div><h2 className="text-[14px] font-semibold text-white">{selected.name || selected.phone}</h2><p className="text-[11px] text-white/40 font-mono">{selected.phone}</p></div>
              </div>
              <div className="relative flex items-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); setShowSearch(!showSearch); }} className="w-9 h-9 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-white/40"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
                <button onClick={(e) => { e.stopPropagation(); setHeaderMenu(!headerMenu); setChatMenu(null); setMsgMenu(null); }} className="w-9 h-9 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-white/40"><ThreeDot/></button>
                {headerMenu && (
                  <div className="absolute right-0 top-11 z-50 bg-[#233138] rounded-xl shadow-2xl py-1.5 min-w-[200px] border border-white/[0.1]" onClick={(e) => e.stopPropagation()}>
                    <MI i="📌" l={selected.is_pinned ? "Unpin chat" : "Pin chat"} o={() => handlePin(selected.id, !selected.is_pinned)}/>
                    <MI i={selected.is_muted ? "🔔" : "🔕"} l={selected.is_muted ? "Unmute" : "Mute"} o={() => handleMute(selected.id, !selected.is_muted)}/>
                    <MI i="📩" l="Mark as unread" o={() => handleMarkUnread(selected.id)}/>
                    <MI i="📦" l="Archive" o={() => handleArchive(selected.id)}/>
                    <div className="h-px bg-white/[0.06] my-1"/>
                    <MI i="🗑️" l="Delete chat" o={() => handleDeleteChat(selected.id)} d/>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-16 py-3" style={{ backgroundColor: "#0b141a", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='300' height='300' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='10' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='.02'/%3E%3C/svg%3E\")" }}>
              {messages.map((msg, i) => {
                const isMe = msg.role === "assistant";
                const replied = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : null;
                return (
                  <div key={msg.id}>
                    {showDateSep(messages, i) && <div className="flex justify-center my-3"><span className="px-3 py-1 rounded-md bg-[#182229] text-[11px] text-white/50 font-medium shadow">{dateLabel(msg.created_at)}</span></div>}
                    <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-[2px] group/m`}>
                      <div className={`relative max-w-[65%] ${isMe ? "order-1" : ""}`}>
                        {/* Reply preview */}
                        {replied && (
                          <div className={`px-2.5 py-1.5 rounded-t-lg text-[11px] border-l-[3px] ${isMe ? "bg-[#025144] border-emerald-300/50" : "bg-[#1d282f] border-purple-400/50"}`}>
                            <p className="font-semibold text-[10px] text-emerald-300 mb-0.5">{replied.role === "user" ? (selected?.name || selected?.phone) : "You"}</p>
                            <p className="truncate text-white/50">{replied.content}</p>
                          </div>
                        )}
                        <div className={`relative px-2 py-1.5 ${
                          msg.message_type === "sticker" ? "bg-transparent" :
                          isMe ? "bg-[#005c4b] rounded-lg rounded-tr-[3px]" : "bg-[#202c33] rounded-lg rounded-tl-[3px]"
                        } ${replied ? "rounded-t-none" : ""}`}>

                          {/* 3-dot on message — top right corner of bubble, visible on hover */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setMsgMenu(msgMenu === msg.id ? null : msg.id); setChatMenu(null); setHeaderMenu(false); }}
                            className={`absolute ${isMe ? "right-1" : "right-1"} top-1 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover/m:opacity-100 z-10 ${
                              isMe ? "hover:bg-white/10 text-white/50" : "hover:bg-white/10 text-white/40"
                            }`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/></svg>
                          </button>

                          {renderMedia(msg)}

                          {/* Time + status row */}
                          <div className="flex items-center justify-end gap-0.5 mt-0.5">
                            {msg.is_starred && <span className="text-[9px]">⭐</span>}
                            <span className="text-[10px] text-white/30">{fmtMsgTime(msg.created_at)}</span>
                            {isMe && statusIcon(msg.status || "sent")}
                          </div>
                        </div>

                        {/* Reaction */}
                        {msg.reaction && <div className={`absolute -bottom-2.5 ${isMe ? "right-2" : "left-2"} bg-[#182229] border border-white/[0.08] rounded-full px-1.5 py-0.5 text-[12px] shadow cursor-pointer hover:scale-110 transition`} onClick={(e) => { e.stopPropagation(); setShowReactionPicker(msg.id); }}>{msg.reaction}</div>}

                        {/* Message menu */}
                        {msgMenu === msg.id && (
                          <div className={`absolute ${isMe ? "right-0" : "left-0"} top-8 z-50 bg-[#233138] rounded-xl shadow-2xl py-1.5 min-w-[180px] border border-white/[0.1]`} onClick={(e) => e.stopPropagation()}>
                            <MI i="↩️" l="Reply" o={() => { setReplyTo(msg); setMsgMenu(null); inputRef.current?.focus(); }}/>
                            <MI i="😀" l="React" o={() => { setShowReactionPicker(msg.id); setMsgMenu(null); }}/>
                            <MI i={msg.is_starred ? "⭐" : "☆"} l={msg.is_starred ? "Unstar" : "Star"} o={() => handleStarMsg(msg.id, !msg.is_starred)}/>
                            <MI i="📋" l="Copy" o={() => { navigator.clipboard.writeText(msg.content); setMsgMenu(null); }}/>
                            <div className="h-px bg-white/[0.06] my-1"/>
                            <MI i="🗑️" l="Delete" o={() => handleDeleteMsg(msg.id)} d/>
                          </div>
                        )}

                        {/* Reaction picker */}
                        {showReactionPicker === msg.id && (
                          <div className={`absolute ${isMe ? "right-0" : "left-0"} -top-12 z-50 bg-[#233138] border border-white/[0.1] rounded-full px-2 py-1.5 flex gap-0.5 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
                            {QUICK_REACTIONS.map((e) => <button key={e} onClick={() => handleReact(msg.id, e)} className="text-[18px] hover:scale-125 transition w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center">{e}</button>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef}/>
            </div>

            {/* Reply Banner */}
            {replyTo && (
              <div className="px-4 sm:px-16 pt-2" style={{ background: "#1a2028" }}>
                <div className="flex items-center gap-3 bg-[#111b21] border-l-[3px] border-emerald-500 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-emerald-400">{replyTo.role === "user" ? (selected?.name || selected?.phone) : "You"}</p><p className="text-[12px] text-white/50 truncate">{replyTo.content}</p></div>
                  <button onClick={() => setReplyTo(null)} className="text-white/30 hover:text-white/60 text-lg">✕</button>
                </div>
              </div>
            )}

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div className="mx-4 sm:mx-16 mb-1 bg-[#182229] rounded-xl border border-white/[0.08] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()} style={{ maxHeight: 300 }}>
                <div className="flex border-b border-white/[0.06] overflow-x-auto px-2 py-1.5 gap-1">
                  {Object.keys(EMOJI_CATEGORIES).map((cat) => <button key={cat} onClick={() => setEmojiCategory(cat)} className={`text-[18px] w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${emojiCategory === cat ? "bg-emerald-500/20" : "hover:bg-white/[0.06]"}`}>{cat}</button>)}
                </div>
                <div className="p-2 overflow-y-auto" style={{ maxHeight: 220 }}>
                  <div className="flex flex-wrap gap-0.5">{EMOJI_CATEGORIES[emojiCategory]?.map((em, i) => <button key={i} onClick={() => { setInput((p) => p + em); setShowEmojiPicker(false); inputRef.current?.focus(); }} className="w-9 h-9 text-[20px] rounded-lg hover:bg-white/[0.08] flex items-center justify-center">{em}</button>)}</div>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="px-4 sm:px-12 py-2 flex items-center gap-2" style={{ background: "#202c33" }}>
              <button onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }} className="w-10 h-10 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-white/40 text-[22px] flex-shrink-0">😀</button>
              <div className="flex-1 bg-[#2a3942] rounded-lg px-4 py-2.5">
                <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSend(); }} placeholder="Type a message" className="w-full bg-transparent text-[14px] text-white placeholder:text-white/30 focus:outline-none"/>
              </div>
              <button onClick={handleSend} disabled={sending || !input.trim()} className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 transition flex items-center justify-center flex-shrink-0" aria-label="Send">
                {sending ? <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center" onClick={() => setImagePreview(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl" onClick={() => setImagePreview(null)}>✕</button>
          <img src={imagePreview} alt="" className="max-w-[90vw] max-h-[90vh] object-contain" onClick={(e) => e.stopPropagation()}/>
        </div>
      )}
    </div>
  );
}

// Menu Item
function MI({ i, l, o, d }: { i: string; l: string; o: () => void; d?: boolean }) {
  return <button onClick={o} className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] ${d ? "text-red-400 hover:bg-red-500/10" : "text-white/85 hover:bg-white/[0.06]"}`}><span className="w-5 text-center">{i}</span><span>{l}</span></button>;
}
