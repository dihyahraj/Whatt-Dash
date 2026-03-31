"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { ConversationWithLastMessage, Message, MessageType } from "@/lib/types";

const EMOJIS: Record<string, string[]> = {
  "😀": ["😀","😃","😄","😁","😅","😂","🤣","😊","😇","🙂","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","👽","👾","🤖","🎃"],
  "👋": ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪"],
  "❤️": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","💕","💞","💓","💗","💖","💘","💝","💟","♥️"],
  "🎉": ["🎉","🎊","🎈","🎁","🎀","🏆","🥇","🔥","⭐","🌟","✨","💫","🌈","☀️","🌙","💡","🔔","📌","💰","💎","📱","💻","📷","🎵","🎶","🎤","🎧","🎸","🎬","📺","📚","📝","✏️","📎","✂️"],
  "🍔": ["🍏","🍎","🍊","🍋","🍌","🍉","🍇","🍓","🍒","🍑","🍍","🥥","🥝","🍅","🥑","🥦","🌽","🥕","🍞","🧀","🍳","🥓","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🌮","🌯","🥗","🍝","🍜","🍲","🍛","🍣","🍱","🍦","🎂","🍩","🍪","☕","🍵","🍺","🍷"],
  "🐶": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🦆","🦅","🦉","🐺","🐴","🦄","🐝","🦋","🐌","🐞","🐢","🐍","🐙","🐬","🐳","🦈","🐊","🐘","🦒"],
};

const QUICK_REACT = ["👍","❤️","😂","😮","😢","🙏","🔥","🎉"];

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
  }, []);

  const [convos, setConvos] = useState<ConversationWithLastMessage[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [chatMenuId, setChatMenuId] = useState<string | null>(null);
  const [msgMenuId, setMsgMenuId] = useState<string | null>(null);
  const [reactPickerId, setReactPickerId] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiCat, setEmojiCat] = useState(Object.keys(EMOJIS)[0]);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [archived, setArchived] = useState<ConversationWithLastMessage[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMsg, setHasNewMsg] = useState(false);
  const sel = convos.find((c) => c.id === selId);

  // Fetch
  const fetchConvos = useCallback(async () => { try { const r = await fetch("/api/conversations"); const d = await r.json(); if (Array.isArray(d)) setConvos(d); } catch {} }, []);
  const fetchMsgs = useCallback(async (id: string) => { try { const r = await fetch(`/api/conversations/${id}/messages`); const d = await r.json(); if (Array.isArray(d)) setMsgs(d); } catch {} }, []);
  const fetchArchived = useCallback(async () => { try { const r = await fetch("/api/conversations/archived"); const d = await r.json(); if (Array.isArray(d)) setArchived(d); } catch {} }, []);

  useEffect(() => { fetchConvos(); fetchArchived(); }, [fetchConvos, fetchArchived]);
  useEffect(() => { if (selId) { fetchMsgs(selId); fetch(`/api/conversations/${selId}/read`, { method: "POST" }).catch(() => {}); setConvos((p) => p.map((c) => c.id === selId ? { ...c, unread_count: 0 } : c)); setIsAtBottom(true); } }, [selId, fetchMsgs]);

  // Only auto-scroll when user is at bottom
  useEffect(() => {
    if (isAtBottom) { endRef.current?.scrollIntoView({ behavior: "smooth" }); setHasNewMsg(false); }
    else if (msgs.length > 0) { setHasNewMsg(true); }
  }, [msgs, isAtBottom]);

  // Track scroll position
  function handleScroll() {
    const el = chatBoxRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setIsAtBottom(atBottom);
    if (atBottom) setHasNewMsg(false);
  }

  function scrollToBottom() {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
    setHasNewMsg(false);
  }

  // Poll 2s + always mark as read if chat open
  useEffect(() => {
    const iv = setInterval(() => {
      fetchConvos();
      if (selId) {
        fetchMsgs(selId);
        // Always mark read while chat is open
        fetch(`/api/conversations/${selId}/read`, { method: "POST" }).catch(() => {});
        setConvos((p) => p.map((c) => c.id === selId ? { ...c, unread_count: 0 } : c));
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [fetchConvos, fetchMsgs, selId]);

  // Realtime
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel("rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as Message;
        if (m.conversation_id === selId) {
          setMsgs((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          // Immediately mark as read since user is viewing this chat
          fetch(`/api/conversations/${selId}/read`, { method: "POST" }).catch(() => {});
        }
        fetchConvos();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (p) => { const u = p.new as Message; setMsgs((prev) => prev.map((m) => m.id === u.id ? u : m)); })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => fetchConvos())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selId, fetchConvos, supabase]);

  useEffect(() => { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); }, []);

  // Send
  async function handleSend() {
    if (!input.trim() || !selId || sending) return;
    setSending(true);
    try {
      const b: Record<string, string> = { message: input.trim() };
      if (replyTo) { b.replyToMsgId = replyTo.id; if (replyTo.whatsapp_msg_id) b.replyToWhatsappId = replyTo.whatsapp_msg_id; }
      const r = await fetch(`/api/conversations/${selId}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
      if (!r.ok) { const d = await r.json(); alert("Error:\n" + JSON.stringify(d, null, 2)); return; }
      setInput(""); setReplyTo(null); fetchMsgs(selId);
    } catch (e) { alert("Network Error: " + String(e)); }
    finally { setSending(false); }
  }

  // Chat actions
  async function act(url: string, body?: object) { await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); fetchConvos(); fetchArchived(); setChatMenuId(null); setHeaderMenu(false); }
  async function delChat(id: string) { if (!confirm("Puri chat delete hogi! Supabase se bhi mit jayegi.")) return; await fetch(`/api/conversations/${id}/delete`, { method: "POST" }); if (selId === id) { setSelId(null); setMsgs([]); } fetchConvos(); fetchArchived(); setChatMenuId(null); setHeaderMenu(false); }
  async function unarchive(id: string) { await fetch(`/api/conversations/${id}/archive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: false }) }); fetchConvos(); fetchArchived(); }
  async function delMsg(id: string) { await fetch(`/api/messages/${id}/delete`, { method: "POST" }); setMsgs((p) => p.map((m) => m.id === id ? { ...m, is_deleted: true, content: "🚫 This message was deleted" } : m)); setMsgMenuId(null); }
  async function starMsg(id: string, v: boolean) { await fetch(`/api/messages/${id}/star`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starred: v }) }); setMsgs((p) => p.map((m) => m.id === id ? { ...m, is_starred: v } : m)); setMsgMenuId(null); }
  async function reactMsg(msgId: string, emoji: string) {
    if (!selId) return; const m = msgs.find((x) => x.id === msgId);
    // If same emoji, remove reaction (send empty string)
    const newEmoji = m?.reaction === emoji ? "" : emoji;
    await fetch(`/api/conversations/${selId}/react`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: msgId, emoji: newEmoji, whatsappMsgId: m?.whatsapp_msg_id || null }) });
    setMsgs((p) => p.map((x) => x.id === msgId ? { ...x, reaction: newEmoji || null } : x)); setReactPickerId(null);
  }

  // Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setReplyTo(null); setChatMenuId(null); setMsgMenuId(null); setReactPickerId(null); setShowEmoji(false); setHeaderMenu(false); setImgPreview(null); setShowChatSearch(false); } };
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h);
  }, []);

  // Helpers
  function ft(d: string) { const t = new Date(d), n = new Date(), df = n.getTime() - t.getTime(); if (df < 86400000 && t.getDate() === n.getDate()) return t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); if (df < 172800000) return "Yesterday"; if (df < 604800000) return t.toLocaleDateString([], { weekday: "short" }); return t.toLocaleDateString([], { month: "short", day: "numeric" }); }
  function mt(d: string) { return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  function ini(n: string | null, p: string) { if (n) { const s = n.trim().split(/\s+/); return s.length >= 2 ? (s[0][0] + s[1][0]).toUpperCase() : n.slice(0, 2).toUpperCase(); } return p.slice(-2); }
  function aclr(id: string) { const c = ["from-emerald-500 to-teal-700","from-blue-500 to-indigo-700","from-purple-500 to-violet-700","from-orange-500 to-red-700","from-pink-500 to-rose-700","from-cyan-500 to-blue-700","from-amber-500 to-orange-700","from-lime-500 to-green-700"]; let h = 0; for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h); return c[Math.abs(h) % c.length]; }
  function lmp(c: ConversationWithLastMessage) { const p = c.last_message_role === "assistant" ? "✓ " : ""; const ic: Partial<Record<MessageType, string>> = { image: "📷 Photo", video: "🎥 Video", audio: "🎵 Audio", document: "📄 Document", sticker: "🏷️ Sticker", location: "📍 Location", contacts: "📇 Contact" }; if (c.last_message_type && c.last_message_type !== "text" && ic[c.last_message_type]) return p + ic[c.last_message_type]; return p + (c.last_message || ""); }
  function si(s: string) {
    if (s === "sent") return <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="inline ml-1"><path d="M11 1L4.5 8.5L1 5.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    if (s === "delivered") return <svg width="20" height="11" viewBox="0 0 20 11" fill="none" className="inline ml-1"><path d="M7 1L1.5 7.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 1L7.5 8.5L5 6" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    if (s === "read") return <svg width="20" height="11" viewBox="0 0 20 11" fill="none" className="inline ml-1"><path d="M7 1L1.5 7.5" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 1L7.5 8.5L5 6" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    return null;
  }
  function dl(d: string) { const t = new Date(d), n = new Date(); if (t.toDateString() === n.toDateString()) return "Today"; const y = new Date(n); y.setDate(y.getDate()-1); if (t.toDateString() === y.toDateString()) return "Yesterday"; return t.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }
  function sd(m: Message[], i: number) { return i === 0 || new Date(m[i].created_at).toDateString() !== new Date(m[i-1].created_at).toDateString(); }

  const filtered = convos.filter((c) => { if (!search) return true; const q = search.toLowerCase(); return c.name?.toLowerCase().includes(q) || c.phone.includes(q) || c.last_message?.toLowerCase().includes(q); });

  // Filter messages by chat search
  const displayMsgs = chatSearch ? msgs.filter((m) => m.content?.toLowerCase().includes(chatSearch.toLowerCase())) : msgs;

  // Media renderer
  function media(msg: Message) {
    if (msg.is_deleted) return <p className="italic text-white/40 text-[13px]">🚫 This message was deleted</p>;
    switch (msg.message_type) {
      case "image": return (<div>{msg.media_url && <img src={msg.media_url} alt="Photo" className="rounded-md max-w-[260px] max-h-[300px] object-cover cursor-pointer hover:brightness-90 transition" onClick={() => setImgPreview(msg.media_url)}/>}{msg.media_caption && msg.media_caption !== "[image]" && <p className="text-[13px] mt-1.5 whitespace-pre-wrap">{msg.media_caption}</p>}</div>);
      case "video": return (<div>{msg.media_url ? <video controls className="rounded-md max-w-[260px]" preload="metadata"><source src={msg.media_url} type={msg.media_mime_type || "video/mp4"}/></video> : <span className="text-[13px]">🎥 Video</span>}{msg.media_caption && <p className="text-[13px] mt-1.5">{msg.media_caption}</p>}</div>);
      case "audio": return msg.media_url ? <audio controls className="max-w-[240px]" preload="metadata"><source src={msg.media_url} type={msg.media_mime_type || "audio/ogg"}/></audio> : <span className="text-[13px]">🎵 Voice</span>;
      case "document": return (<a href={msg.media_url || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 bg-white/[0.06] hover:bg-white/[0.10] transition rounded-lg p-3 min-w-[200px]"><div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-xl">📄</div><div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate text-white">{msg.media_filename || "Document"}</p><p className="text-[11px] text-white/40 mt-0.5">{msg.media_mime_type || "File"} • Tap to open</p></div><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="flex-shrink-0 opacity-50"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>);
      case "sticker": return msg.media_url ? <img src={msg.media_url} alt="" className="w-[120px] h-[120px] object-contain"/> : <span className="text-4xl">🏷️</span>;
      case "location": return (<a href={`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`} target="_blank" rel="noreferrer" className="block bg-white/[0.06] hover:bg-white/[0.10] transition rounded-lg p-3 min-w-[180px]"><p className="text-[13px] font-medium">📍 {msg.location_name || "Location"}</p>{msg.location_address && <p className="text-[11px] text-white/40 mt-0.5">{msg.location_address}</p>}<p className="text-[11px] text-emerald-400 mt-1">Open in Maps →</p></a>);
      default: return <p className="text-[13px] whitespace-pre-wrap break-words leading-[1.45]">{msg.content}</p>;
    }
  }

  // Chat menu dropdown
  function ChatMenu({ convo, onClose }: { convo: ConversationWithLastMessage; onClose: () => void }) {
    return (
      <div className="absolute right-2 top-full mt-1 z-[100] bg-[#233138] rounded-xl shadow-2xl py-1.5 min-w-[190px] border border-white/[0.1] animate-in" onClick={(e) => e.stopPropagation()}>
        <MI i="📌" l={convo.is_pinned ? "Unpin chat" : "Pin chat"} o={() => { act(`/api/conversations/${convo.id}/pin`, { pinned: !convo.is_pinned }); onClose(); }}/>
        <MI i={convo.is_muted ? "🔔" : "🔕"} l={convo.is_muted ? "Unmute" : "Mute"} o={() => { act(`/api/conversations/${convo.id}/mute`, { muted: !convo.is_muted }); onClose(); }}/>
        <MI i="📩" l="Mark as unread" o={() => { act(`/api/conversations/${convo.id}/unread`, { unread_count: 1 }); onClose(); }}/>
        <MI i="📦" l="Archive" o={() => { act(`/api/conversations/${convo.id}/archive`, { archived: true }); onClose(); }}/>
        <div className="h-px bg-white/[0.06] my-1"/>
        <MI i="🗑️" l="Delete chat" o={() => { delChat(convo.id); onClose(); }} d/>
      </div>
    );
  }

  if (authLoading) return (
    <div className="min-h-screen bg-[#0b141a] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full"/>
    </div>
  );

  if (!user) {
    window.location.href = "/login";
    return (
      <div className="min-h-screen bg-[#0b141a] flex items-center justify-center">
        <p className="text-white/30 text-sm">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0b0b0b] overflow-hidden select-none" style={{ fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif" }}>

      {/* ═══ SIDEBAR ═══ */}
      <div className="w-[340px] flex flex-col border-r border-white/[0.06] flex-shrink-0" style={{ background: "#111" }}>
        <div className="px-4 pt-3.5 pb-2.5 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.632.632l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.379 0-4.588-.813-6.334-2.176l-.442-.352-3.17 1.063 1.063-3.17-.352-.442A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
              </div>
              <div><h1 className="text-[14px] font-bold text-white">Whatt Dash</h1><p className="text-[11px] text-white/35">{user.display_name} • {convos.length} chat{convos.length !== 1 ? "s" : ""}</p></div>
            </div>
            <div className="flex items-center gap-0.5">
              {user.role === "admin" && (
                <button onClick={() => router.push("/admin")} className="w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70" title="Manage Users">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </button>
              )}
              <button onClick={() => setShowSearch(!showSearch)} className="w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
              <button onClick={signOut} className="w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-red-400" title="Sign Out">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          </div>
          {showSearch && <div className="relative mt-2.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats..." className="w-full bg-white/[0.05] rounded-lg pl-9 pr-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:outline-none border border-white/[0.06]" autoFocus/></div>}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <div className="flex flex-col items-center justify-center h-48 text-white/25 text-xs">{search ? "No results" : "No conversations yet"}</div>}
          {filtered.map((c) => {
            const isSel = selId === c.id;
            return (
              <div key={c.id} className={`relative ${isSel ? "bg-[#2a3942]" : "hover:bg-white/[0.03]"}`}>
                <div className="flex items-center px-3 py-3 cursor-pointer" onClick={() => { setSelId(c.id); setChatMenuId(null); }}>
                  <div className={`w-[48px] h-[48px] rounded-full bg-gradient-to-br ${aclr(c.id)} flex items-center justify-center flex-shrink-0 text-white text-[14px] font-bold`}>{ini(c.name, c.phone)}</div>
                  <div className="flex-1 min-w-0 ml-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-[14px] truncate ${c.unread_count > 0 ? "font-bold text-white" : "font-medium text-white/80"}`}>{c.name || c.phone}</span>
                      <span className={`text-[11px] flex-shrink-0 ml-2 ${c.unread_count > 0 ? "text-emerald-400" : "text-white/30"}`}>{ft(c.last_message_time || c.updated_at)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-[12px] truncate ${c.unread_count > 0 ? "text-white/60" : "text-white/35"}`}>{lmp(c)}</p>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {c.is_pinned && <span className="text-[10px]">📌</span>}
                        {c.is_muted && <span className="text-[10px]">🔕</span>}
                        {c.unread_count > 0 && <span className="min-w-[18px] h-[18px] rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center px-1">{c.unread_count}</span>}
                      </div>
                    </div>
                  </div>
                  {/* 3-dot button — INSIDE the row, after content */}
                  <div className="relative ml-1 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setChatMenuId(chatMenuId === c.id ? null : c.id); setMsgMenuId(null); setHeaderMenu(false); }}
                      className="w-7 h-7 rounded-full hover:bg-white/[0.12] flex items-center justify-center text-white/30 hover:text-white/60"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                    </button>
                    {chatMenuId === c.id && <ChatMenu convo={c} onClose={() => setChatMenuId(null)}/>}
                  </div>
                </div>
              </div>
            );
          })}

          {/* ═══ ARCHIVED ═══ */}
          {archived.length > 0 && (
            <div className="border-t border-white/[0.06]">
              <button onClick={() => { setShowArchived(!showArchived); if (!showArchived) fetchArchived(); }} className="w-full flex items-center gap-3 px-4 py-3 text-white/50 hover:bg-white/[0.03]">
                <span>📦</span>
                <span className="text-[13px] font-medium">Archived ({archived.length})</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`ml-auto transition-transform ${showArchived ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {showArchived && archived.map((ac) => (
                <div key={ac.id} className="flex items-center px-3 py-2.5 hover:bg-white/[0.03]">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${aclr(ac.id)} flex items-center justify-center flex-shrink-0 text-white text-[12px] font-bold opacity-60`}>{ini(ac.name, ac.phone)}</div>
                  <div className="flex-1 min-w-0 ml-3 cursor-pointer" onClick={() => setSelId(ac.id)}>
                    <span className="text-[13px] text-white/50 truncate block">{ac.name || ac.phone}</span>
                    <p className="text-[11px] text-white/30 truncate">{lmp(ac)}</p>
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <button onClick={() => unarchive(ac.id)} className="px-2 py-1 text-[10px] bg-emerald-600/20 text-emerald-400 rounded hover:bg-emerald-600/30 font-medium">Unarchive</button>
                    <button onClick={() => delChat(ac.id)} className="px-2 py-1 text-[10px] bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 font-medium">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ CHAT ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {!sel ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: "radial-gradient(ellipse at center, rgba(16,185,129,0.03) 0%, #0b0b0b 70%)" }}>
            <div className="w-20 h-20 rounded-3xl bg-white/[0.03] flex items-center justify-center border border-white/[0.06]"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
            <p className="text-[14px] text-white/20">Select a chat</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between" style={{ background: "#202c33" }}>
              <div className="flex items-center gap-3 cursor-pointer">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${aclr(sel.id)} flex items-center justify-center text-white text-sm font-bold`}>{ini(sel.name, sel.phone)}</div>
                <div><h2 className="text-[14px] font-semibold text-white">{sel.name || sel.phone}</h2><p className="text-[11px] text-white/40 font-mono">{sel.phone}</p></div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setShowChatSearch(!showChatSearch); setChatSearch(""); }} className="w-9 h-9 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-white/40"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setHeaderMenu(!headerMenu); setChatMenuId(null); setMsgMenuId(null); }} className="w-9 h-9 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-white/40">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                  </button>
                  {headerMenu && (
                    <div className="absolute right-0 top-full mt-1 z-[100] bg-[#233138] rounded-xl shadow-2xl py-1.5 min-w-[200px] border border-white/[0.1]" onClick={(e) => e.stopPropagation()}>
                      <MI i="📌" l={sel.is_pinned ? "Unpin chat" : "Pin chat"} o={() => act(`/api/conversations/${sel.id}/pin`, { pinned: !sel.is_pinned })}/>
                      <MI i={sel.is_muted ? "🔔" : "🔕"} l={sel.is_muted ? "Unmute" : "Mute"} o={() => act(`/api/conversations/${sel.id}/mute`, { muted: !sel.is_muted })}/>
                      <MI i="📩" l="Mark as unread" o={() => act(`/api/conversations/${sel.id}/unread`, { unread_count: 1 })}/>
                      <MI i="📦" l="Archive" o={() => { act(`/api/conversations/${sel.id}/archive`, { archived: true }); if (selId === sel.id) { setSelId(null); setMsgs([]); } }}/>
                      <div className="h-px bg-white/[0.06] my-1"/>
                      <MI i="🗑️" l="Delete chat" o={() => delChat(sel.id)} d/>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chat search bar */}
            {showChatSearch && (
              <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2" style={{ background: "#1a2028" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} placeholder="Search in chat..." className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/25 focus:outline-none" autoFocus/>
                <button onClick={() => { setShowChatSearch(false); setChatSearch(""); }} className="text-white/30 hover:text-white/60 text-sm">✕</button>
              </div>
            )}

            {/* Messages */}
            <div ref={chatBoxRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 sm:px-16 py-3 relative" style={{ backgroundColor: "#0b141a" }}>
              {displayMsgs.map((msg, i) => {
                const isMe = msg.role === "assistant";
                const replied = msg.reply_to_id ? msgs.find((m) => m.id === msg.reply_to_id) : null;
                return (
                  <div key={msg.id}>
                    {sd(displayMsgs, i) && <div className="flex justify-center my-3"><span className="px-3 py-1 rounded-md bg-[#182229] text-[11px] text-white/50 shadow">{dl(msg.created_at)}</span></div>}
                    <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-[2px] group/m`}>
                      <div className={`relative max-w-[65%]`}>
                        {replied && <div className={`px-2.5 py-1.5 rounded-t-lg text-[11px] border-l-[3px] ${isMe ? "bg-[#025144] border-emerald-300/50" : "bg-[#1d282f] border-purple-400/50"}`}><p className="font-semibold text-[10px] text-emerald-300 mb-0.5">{replied.role === "user" ? (sel?.name || sel?.phone) : "You"}</p><p className="truncate text-white/50">{replied.content}</p></div>}

                        <div className={`relative px-2.5 py-1.5 ${msg.message_type === "sticker" ? "bg-transparent" : isMe ? "bg-[#005c4b] rounded-lg rounded-tr-[3px]" : "bg-[#202c33] rounded-lg rounded-tl-[3px]"} ${replied ? "rounded-t-none" : ""}`}>
                          {/* Menu button on hover — WhatsApp style */}
                          <div className={`absolute right-0 top-0 opacity-0 group-hover/m:opacity-100 z-10`}>
                            <button onClick={(e) => { e.stopPropagation(); setMsgMenuId(msgMenuId === msg.id ? null : msg.id); setChatMenuId(null); setHeaderMenu(false); }}
                              className={`w-7 h-7 rounded-bl-lg flex items-center justify-center ${isMe ? "bg-[#005c4b] hover:bg-[#04705b]" : "bg-[#202c33] hover:bg-[#28353d]"}`}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.6"><path d="M6 9l6 6 6-6"/></svg>
                            </button>
                          </div>

                          {media(msg)}
                          <div className="flex items-center justify-end gap-0.5 mt-0.5">
                            {msg.is_starred && <span className="text-[9px]">⭐</span>}
                            <span className="text-[10px] text-white/30">{mt(msg.created_at)}</span>
                            {isMe && si(msg.status || "sent")}
                          </div>
                        </div>

                        {msg.reaction && <div className={`absolute -bottom-2.5 ${isMe ? "right-2" : "left-2"} bg-[#182229] border border-white/[0.08] rounded-full px-1.5 py-0.5 text-[12px] shadow cursor-pointer hover:scale-110 transition group/react`} onClick={(e) => { e.stopPropagation(); reactMsg(msg.id, msg.reaction!); }} title="Click to remove">{msg.reaction}<span className="hidden group-hover/react:inline text-[9px] ml-0.5 text-white/30">✕</span></div>}

                        {/* Msg menu */}
                        {msgMenuId === msg.id && (
                          <div className={`absolute ${isMe ? "right-0" : "left-0"} top-8 z-[100] bg-[#233138] rounded-xl shadow-2xl py-1.5 min-w-[170px] border border-white/[0.1]`} onClick={(e) => e.stopPropagation()}>
                            <MI i="↩️" l="Reply" o={() => { setReplyTo(msg); setMsgMenuId(null); inputRef.current?.focus(); }}/>
                            <MI i="😀" l="React" o={() => { setReactPickerId(msg.id); setMsgMenuId(null); }}/>
                            <MI i={msg.is_starred ? "⭐" : "☆"} l={msg.is_starred ? "Unstar" : "Star"} o={() => starMsg(msg.id, !msg.is_starred)}/>
                            <MI i="📋" l="Copy" o={() => { navigator.clipboard.writeText(msg.content); setMsgMenuId(null); }}/>
                            <div className="h-px bg-white/[0.06] my-1"/>
                            <MI i="🗑️" l="Delete" o={() => delMsg(msg.id)} d/>
                          </div>
                        )}

                        {reactPickerId === msg.id && (
                          <div className={`absolute ${isMe ? "right-0" : "left-0"} -top-12 z-[100] bg-[#233138] border border-white/[0.1] rounded-full px-2 py-1.5 flex gap-0.5 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
                            {QUICK_REACT.map((e) => <button key={e} onClick={() => reactMsg(msg.id, e)} className="text-[18px] hover:scale-125 transition w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center">{e}</button>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef}/>
            </div>

            {/* Scroll to bottom arrow */}
            {!isAtBottom && (
              <div className="relative">
                <button onClick={scrollToBottom} className="absolute right-6 -top-14 w-10 h-10 rounded-full bg-[#202c33] border border-white/[0.1] shadow-lg flex items-center justify-center hover:bg-[#2a3942] transition-colors z-20">
                  {hasNewMsg && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">!</span>}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </button>
              </div>
            )}

            {/* Reply */}
            {replyTo && (
              <div className="px-4 sm:px-16 pt-2" style={{ background: "#1a2028" }}>
                <div className="flex items-center gap-3 bg-[#111b21] border-l-[3px] border-emerald-500 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-emerald-400">{replyTo.role === "user" ? (sel?.name || sel?.phone) : "You"}</p><p className="text-[12px] text-white/50 truncate">{replyTo.content}</p></div>
                  <button onClick={() => setReplyTo(null)} className="text-white/30 hover:text-white/60 text-lg">✕</button>
                </div>
              </div>
            )}

            {/* Emoji */}
            {showEmoji && (
              <div className="mx-4 sm:mx-16 mb-1 bg-[#182229] rounded-xl border border-white/[0.08] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()} style={{ maxHeight: 280 }}>
                <div className="flex border-b border-white/[0.06] px-2 py-1.5 gap-1">
                  {Object.keys(EMOJIS).map((c) => <button key={c} onClick={() => setEmojiCat(c)} className={`text-[18px] w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${emojiCat === c ? "bg-emerald-500/20" : "hover:bg-white/[0.06]"}`}>{c}</button>)}
                </div>
                <div className="p-2 overflow-y-auto" style={{ maxHeight: 200 }}>
                  <div className="flex flex-wrap gap-0.5">{EMOJIS[emojiCat]?.map((em, i) => <button key={i} onClick={() => { setInput((p) => p + em); setShowEmoji(false); inputRef.current?.focus(); }} className="w-9 h-9 text-[20px] rounded-lg hover:bg-white/[0.08] flex items-center justify-center">{em}</button>)}</div>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="px-4 sm:px-12 py-2 flex items-center gap-2" style={{ background: "#202c33" }}>
              <button onClick={(e) => { e.stopPropagation(); setShowEmoji(!showEmoji); }} className="w-10 h-10 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-white/40 text-[22px] flex-shrink-0">😀</button>
              <button onClick={() => document.getElementById("file-input")?.click()} className="w-10 h-10 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-white/40 flex-shrink-0" title="Attach file">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              </button>
              <input id="file-input" type="file" className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !selId) return;
                setSending(true);
                try {
                  const fd = new FormData();
                  fd.append("file", file);
                  fd.append("caption", "");
                  const res = await fetch(`/api/conversations/${selId}/send-media`, { method: "POST", body: fd });
                  if (!res.ok) { const d = await res.json(); alert("Error: " + JSON.stringify(d)); }
                  else { fetchMsgs(selId); scrollToBottom(); }
                } catch (err) { alert("Error: " + String(err)); }
                finally { setSending(false); e.target.value = ""; }
              }}/>
              <div className="flex-1 bg-[#2a3942] rounded-lg px-4 py-2.5"><input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSend(); }} placeholder="Type a message" className="w-full bg-transparent text-[14px] text-white placeholder:text-white/30 focus:outline-none"/></div>
              <button onClick={handleSend} disabled={sending || !input.trim()} className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 transition flex items-center justify-center flex-shrink-0">
                {sending ? <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Image Preview */}
      {imgPreview && <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center" onClick={() => setImgPreview(null)}><button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl">✕</button><img src={imgPreview} alt="" className="max-w-[90vw] max-h-[90vh] object-contain" onClick={(e) => e.stopPropagation()}/></div>}

      {/* Click-away to close menus */}
      {(chatMenuId || msgMenuId || headerMenu || reactPickerId) && <div className="fixed inset-0 z-[90]" onClick={() => { setChatMenuId(null); setMsgMenuId(null); setHeaderMenu(false); setReactPickerId(null); }}/>}
    </div>
  );
}

function MI({ i, l, o, d }: { i: string; l: string; o: () => void; d?: boolean }) {
  return <button onClick={o} className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] ${d ? "text-red-400 hover:bg-red-500/10" : "text-white/85 hover:bg-white/[0.06]"}`}><span className="w-5 text-center">{i}</span><span>{l}</span></button>;
}
