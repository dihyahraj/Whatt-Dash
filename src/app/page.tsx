"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import type { ConversationWithLastMessage, Message, MessageType } from "@/lib/types";

// ============================================================
// WHATT-DASH v2 — Full WhatsApp Business Dashboard
// ============================================================

const EMOJI_CATEGORIES: Record<string, string[]> = {
  "😀 Smileys": ["😀","😃","😄","😁","😅","😂","🤣","😊","😇","🙂","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🫡","🤭","🫢","🫣","🤫","🤥","😶","🫥","😐","🫤","😑","🫠","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🫨","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾"],
  "👋 Hands": ["👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦿","🦵","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄","🫦"],
  "❤️ Hearts": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","💕","💞","💓","💗","💖","💘","💝","💟","♥️","🩷","🩵","🩶"],
  "🎉 Objects": ["🎉","🎊","🎈","🎁","🎀","🏆","🥇","🥈","🥉","⚽","🏀","🏈","⚾","🎾","🏐","🎯","🔥","⭐","🌟","✨","💫","🌈","☀️","🌙","💡","🔔","📌","📍","🗝️","🔑","💰","💵","💎","📱","💻","⌚","📷","🎵","🎶","🎤","🎧","🎸","🎹","🎺","🥁","🎬","📺","📻","📚","📖","📝","✏️","📎","📐","✂️","🗂️","📁","📂"],
  "🍔 Food": ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🥐","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","🍼","🫖","☕","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾","🧊"],
  "🐶 Animals": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪰","🪲","🪳","🦟","🦗","🕷️","🦂","🐢","🐍","🦎","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐕‍🦺","🐈","🐈‍⬛","🐓","🦃","🦤","🦚","🦜","🦢","🦩","🕊️","🐇","🦝","🦨","🦡","🦫","🦦","🦥","🐁","🐀","🐿️","🦔"],
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

  // ─── Data Fetching ────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try { const r = await fetch("/api/conversations"); const d = await r.json(); if (Array.isArray(d)) setConversations(d); } catch (e) { console.error(e); }
  }, []);
  const fetchMessages = useCallback(async (id: string) => {
    try { const r = await fetch(`/api/conversations/${id}/messages`); const d = await r.json(); if (Array.isArray(d)) setMessages(d); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
      fetch(`/api/conversations/${selectedId}/read`, { method: "POST" }).catch(() => {});
      setConversations((p) => p.map((c) => (c.id === selectedId ? { ...c, unread_count: 0 } : c)));
    }
  }, [selectedId, fetchMessages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ─── Polling every 3s (guaranteed delivery) ───────────────
  useEffect(() => {
    const iv = setInterval(() => { fetchConversations(); if (selectedId) fetchMessages(selectedId); }, 3000);
    return () => clearInterval(iv);
  }, [fetchConversations, fetchMessages, selectedId]);

  // ─── Realtime (bonus) ─────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel("rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as Message;
        if (m.conversation_id === selectedId) setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
        if (m.role === "user" && m.conversation_id !== selectedId) showNotif(m);
        fetchConversations();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (p) => {
        const u = p.new as Message; setMessages((prev) => prev.map((x) => (x.id === u.id ? u : x)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => fetchConversations())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedId, fetchConversations, supabase]);

  // ─── Notifications ────────────────────────────────────────
  useEffect(() => { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); }, []);
  function showNotif(msg: Message) {
    if ("Notification" in window && Notification.permission === "granted") {
      const c = conversations.find((x) => x.id === msg.conversation_id);
      new Notification(c?.name || c?.phone || "New Message", { body: msg.content?.substring(0, 100) || "New message", icon: "/favicon.ico", tag: msg.conversation_id });
    }
  }

  // ─── Actions ──────────────────────────────────────────────
  async function handleSend() {
    if (!input.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      const b: Record<string, string> = { message: input.trim() };
      if (replyTo) { b.replyToMsgId = replyTo.id; if (replyTo.whatsapp_msg_id) b.replyToWhatsappId = replyTo.whatsapp_msg_id; }
      const r = await fetch(`/api/conversations/${selectedId}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
      const d = await r.json();
      if (!r.ok) { alert("Error: " + JSON.stringify(d, null, 2)); return; }
      setInput(""); setReplyTo(null); fetchMessages(selectedId);
    } catch (e) { alert("Network Error: " + String(e)); }
    finally { setSending(false); }
  }

  async function apiPost(url: string, body?: object) { await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); }
  function closeMenus() { setChatMenu(null); setMsgMenu(null); setHeaderMenu(false); }

  async function handlePin(id: string, v: boolean) { await apiPost(`/api/conversations/${id}/pin`, { pinned: v }); fetchConversations(); closeMenus(); }
  async function handleMute(id: string, v: boolean) { await apiPost(`/api/conversations/${id}/mute`, { muted: v }); fetchConversations(); closeMenus(); }
  async function handleMarkUnread(id: string) { await apiPost(`/api/conversations/${id}/unread`, { unread_count: 1 }); fetchConversations(); closeMenus(); }
  async function handleArchive(id: string) { await apiPost(`/api/conversations/${id}/archive`, { archived: true }); if (selectedId === id) { setSelectedId(null); setMessages([]); } fetchConversations(); closeMenus(); }
  async function handleDeleteChat(id: string) { if (!confirm("Delete this entire conversation?")) return; await apiPost(`/api/conversations/${id}/delete`); if (selectedId === id) { setSelectedId(null); setMessages([]); } fetchConversations(); closeMenus(); }
  async function handleDeleteMsg(id: string) { await apiPost(`/api/messages/${id}/delete`); setMessages((p) => p.map((m) => (m.id === id ? { ...m, is_deleted: true, content: "🚫 This message was deleted" } : m))); setMsgMenu(null); }
  async function handleStar(id: string, v: boolean) { await apiPost(`/api/messages/${id}/star`, { starred: v }); setMessages((p) => p.map((m) => (m.id === id ? { ...m, is_starred: v } : m))); setMsgMenu(null); }
  async function handleReact(msgId: string, emoji: string) {
    if (!selectedId) return;
    const msg = messages.find((m) => m.id === msgId);
    await apiPost(`/api/conversations/${selectedId}/react`, { messageId: msgId, emoji, whatsappMsgId: msg?.whatsapp_msg_id || null });
    setMessages((p) => p.map((m) => (m.id === msgId ? { ...m, reaction: emoji } : m))); setShowReactionPicker(null);
  }

  // ─── Close menus ──────────────────────────────────────────
  useEffect(() => { const h = () => { closeMenus(); setShowReactionPicker(null); setShowEmojiPicker(false); }; document.addEventListener("click", h); return () => document.removeEventListener("click", h); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setReplyTo(null); closeMenus(); setShowReactionPicker(null); setShowEmojiPicker(false); setImagePreview(null); } if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setShowSearch((p) => !p); } };
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h);
  }, []);

  // ─── Helpers ──────────────────────────────────────────────
  function fmtTime(d: string) { const t = new Date(d), n = new Date(), df = n.getTime()-t.getTime(); if (df < 86400000 && t.getDate()===n.getDate()) return t.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}); if (df < 172800000) return "Yesterday"; if (df < 604800000) return t.toLocaleDateString([],{weekday:"short"}); return t.toLocaleDateString([],{month:"short",day:"numeric"}); }
  function fmtMsgTime(d: string) { return new Date(d).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}); }
  function initials(name: string|null, phone: string) { if (name) { const p=name.trim().split(/\s+/); return p.length>=2?(p[0][0]+p[1][0]).toUpperCase():name.slice(0,2).toUpperCase(); } return phone.slice(-2); }
  function avatarColor(id: string) { const c=["from-emerald-500 to-teal-700","from-blue-500 to-indigo-700","from-purple-500 to-violet-700","from-orange-500 to-red-700","from-pink-500 to-rose-700","from-cyan-500 to-blue-700","from-amber-500 to-orange-700","from-lime-500 to-green-700"]; let h=0; for(let i=0;i<id.length;i++) h=id.charCodeAt(i)+((h<<5)-h); return c[Math.abs(h)%c.length]; }
  function preview(c: ConversationWithLastMessage) { const p=c.last_message_role==="assistant"?"✓ You: ":""; const i:Partial<Record<MessageType,string>>={image:"📷 Photo",video:"🎥 Video",audio:"🎵 Audio",document:"📄 Document",sticker:"🏷️ Sticker",location:"📍 Location",contacts:"📇 Contact"}; if(c.last_message_type&&c.last_message_type!=="text"&&i[c.last_message_type]) return p+i[c.last_message_type]; return p+(c.last_message||""); }
  function statusIcon(s: string) {
    if(s==="sent") return <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="inline ml-1"><path d="M11 1L4.5 8.5L1 5.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    if(s==="delivered") return <svg width="20" height="11" viewBox="0 0 20 11" fill="none" className="inline ml-1"><path d="M7 1L1.5 7.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 1L7.5 8.5L5 6" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    if(s==="read") return <svg width="20" height="11" viewBox="0 0 20 11" fill="none" className="inline ml-1"><path d="M7 1L1.5 7.5" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 1L7.5 8.5L5 6" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    return null;
  }
  function dateLabel(d: string) { const t=new Date(d),n=new Date(); if(t.toDateString()===n.toDateString()) return "Today"; const y=new Date(n); y.setDate(y.getDate()-1); if(t.toDateString()===y.toDateString()) return "Yesterday"; return t.toLocaleDateString([],{weekday:"long",month:"long",day:"numeric",year:"numeric"}); }
  function showDate(msgs: Message[], i: number) { return i===0||new Date(msgs[i].created_at).toDateString()!==new Date(msgs[i-1].created_at).toDateString(); }

  const filtered = conversations.filter((c) => { if(!searchQuery) return true; const q=searchQuery.toLowerCase(); return c.name?.toLowerCase().includes(q)||c.phone.includes(q)||c.last_message?.toLowerCase().includes(q); });

  function renderMedia(msg: Message) {
    if(msg.is_deleted) return <p className="italic text-white/40 text-[13px]">🚫 This message was deleted</p>;
    switch(msg.message_type) {
      case "image": return <div>{msg.media_url&&<img src={msg.media_url} alt="" className="rounded-lg max-w-[260px] cursor-pointer hover:opacity-90" onClick={()=>setImagePreview(msg.media_url)} onError={(e)=>{(e.target as HTMLImageElement).style.display="none";}}/>}{msg.media_caption&&<p className="text-[13px] mt-1.5 whitespace-pre-wrap">{msg.media_caption}</p>}</div>;
      case "video": return <div>{msg.media_url?<video controls className="rounded-lg max-w-[260px]" preload="metadata"><source src={msg.media_url} type={msg.media_mime_type||"video/mp4"}/></video>:<span className="text-[13px]">🎥 Video</span>}{msg.media_caption&&<p className="text-[13px] mt-1.5">{msg.media_caption}</p>}</div>;
      case "audio": return msg.media_url?<audio controls className="max-w-[240px]" preload="metadata"><source src={msg.media_url} type={msg.media_mime_type||"audio/ogg"}/></audio>:<span className="text-[13px]">🎵 Voice message</span>;
      case "document": return <div className="flex items-center gap-2.5 bg-white/5 rounded-lg p-2.5 min-w-[180px]"><div className="w-9 h-9 rounded bg-white/10 flex items-center justify-center flex-shrink-0"><span className="text-lg">📄</span></div><div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate">{msg.media_filename||"Document"}</p><p className="text-[11px] text-white/35">{msg.media_mime_type||"File"}</p></div></div>;
      case "sticker": return msg.media_url?<img src={msg.media_url} alt="" className="w-[120px] h-[120px] object-contain"/>:<span className="text-4xl">🏷️</span>;
      case "location": return <a href={`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`} target="_blank" rel="noreferrer" className="block bg-white/5 rounded-lg overflow-hidden min-w-[180px]"><div className="p-2.5"><p className="text-[13px] font-medium">📍 {msg.location_name||"Location"}</p>{msg.location_address&&<p className="text-[11px] text-white/35 mt-0.5">{msg.location_address}</p>}</div></a>;
      default: return <p className="text-[13px] whitespace-pre-wrap break-words leading-[1.45]">{msg.content}</p>;
    }
  }

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#0b0b0b] overflow-hidden select-none" style={{fontFamily:"'Segoe UI',Helvetica,Arial,sans-serif"}}>

      {/* ══════ SIDEBAR ══════ */}
      <div className="w-[340px] flex flex-col border-r border-white/[0.06] flex-shrink-0" style={{background:"#111"}}>
        <div className="px-4 pt-3.5 pb-2.5 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/15">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.632.632l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.379 0-4.588-.813-6.334-2.176l-.442-.352-3.17 1.063 1.063-3.17-.352-.442A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
              </div>
              <div><h1 className="text-[14px] font-bold text-white">Whatt Dash</h1><p className="text-[11px] text-white/35">{conversations.length} chat{conversations.length!==1?"s":""}</p></div>
            </div>
            <button onClick={(e)=>{e.stopPropagation();setShowSearch(!showSearch);}} className="w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
          </div>
          {showSearch&&<div className="relative mt-2.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="Search or start new chat" className="w-full bg-white/[0.05] rounded-lg pl-9 pr-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:outline-none border border-white/[0.06] focus:border-emerald-500/30" autoFocus/></div>}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length===0&&<div className="flex flex-col items-center justify-center h-48 gap-2"><div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><p className="text-xs text-white/25">{searchQuery?"No results":"No conversations yet"}</p></div>}
          {filtered.map((c)=>{const isSel=selectedId===c.id;return(
            <div key={c.id} className={`relative group ${isSel?"bg-emerald-500/10":"hover:bg-white/[0.03]"}`}>
              {isSel&&<div className="absolute left-0 top-2 bottom-2 w-[3px] bg-emerald-500 rounded-r-full"/>}
              <button onClick={()=>{setSelectedId(c.id);setChatMenu(null);}} className="w-full text-left px-3 py-3 flex items-center gap-3">
                <div className={`w-[48px] h-[48px] rounded-full bg-gradient-to-br ${avatarColor(c.id)} flex items-center justify-center flex-shrink-0 text-white text-[14px] font-bold`}>{initials(c.name,c.phone)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0"><span className={`text-[14px] truncate ${c.unread_count>0?"font-bold text-white":"font-medium text-white/80"}`}>{c.name||c.phone}</span>{c.is_muted&&<span className="text-white/25 flex-shrink-0 text-[12px]">🔕</span>}</div>
                    <span className={`text-[11px] flex-shrink-0 ${c.unread_count>0?"text-emerald-400 font-semibold":"text-white/30"}`}>{fmtTime(c.last_message_time||c.updated_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={`text-[12px] truncate ${c.unread_count>0?"text-white/60 font-medium":"text-white/35"}`}>{preview(c)}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">{c.is_pinned&&<span className="text-[10px]">📌</span>}{c.unread_count>0&&<span className="min-w-[18px] h-[18px] rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center px-1">{c.unread_count}</span>}</div>
                  </div>
                </div>
              </button>
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e)=>{e.stopPropagation();setChatMenu(chatMenu===c.id?null:c.id);}} className="w-7 h-7 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-white/40"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button></div>
              {chatMenu===c.id&&<div className="absolute right-2 top-9 z-50 bg-[#233138] rounded-lg shadow-2xl py-1 min-w-[180px] border border-white/[0.08]" onClick={(e)=>e.stopPropagation()}><MI i="📌" l={c.is_pinned?"Unpin chat":"Pin chat"} o={()=>handlePin(c.id,!c.is_pinned)}/><MI i={c.is_muted?"🔔":"🔕"} l={c.is_muted?"Unmute":"Mute notifications"} o={()=>handleMute(c.id,!c.is_muted)}/><MI i="📩" l="Mark as unread" o={()=>handleMarkUnread(c.id)}/><MI i="📦" l="Archive chat" o={()=>handleArchive(c.id)}/><div className="h-px bg-white/[0.06] my-0.5"/><MI i="🗑️" l="Delete chat" o={()=>handleDeleteChat(c.id)} d/></div>}
            </div>
          );})}
        </div>
      </div>

      {/* ══════ CHAT PANEL ══════ */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected?(
          <div className="flex-1 flex flex-col items-center justify-center gap-5" style={{background:"radial-gradient(ellipse at center,rgba(16,185,129,0.03) 0%,#0b0b0b 70%)"}}>
            <div className="w-20 h-20 rounded-3xl bg-white/[0.03] flex items-center justify-center border border-white/[0.06]"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
            <div className="text-center"><p className="text-[15px] font-semibold text-white/25">Whatt Dash</p><p className="text-[12px] text-white/15 mt-1">Select a conversation to start chatting</p></div>
          </div>
        ):(
          <>
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between" style={{background:"#111"}}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(selected.id)} flex items-center justify-center text-white text-sm font-bold`}>{initials(selected.name,selected.phone)}</div>
                <div><h2 className="text-[14px] font-bold text-white">{selected.name||selected.phone}</h2><p className="text-[11px] text-white/35 font-mono">{selected.phone}</p></div>
              </div>
              <div className="relative">
                <button onClick={(e)=>{e.stopPropagation();setHeaderMenu(!headerMenu);}} className="w-9 h-9 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button>
                {headerMenu&&<div className="absolute right-0 top-10 z-50 bg-[#233138] rounded-lg shadow-2xl py-1 min-w-[200px] border border-white/[0.08]" onClick={(e)=>e.stopPropagation()}><MI i="📌" l={selected.is_pinned?"Unpin chat":"Pin chat"} o={()=>handlePin(selected.id,!selected.is_pinned)}/><MI i={selected.is_muted?"🔔":"🔕"} l={selected.is_muted?"Unmute":"Mute notifications"} o={()=>handleMute(selected.id,!selected.is_muted)}/><MI i="📩" l="Mark as unread" o={()=>handleMarkUnread(selected.id)}/><MI i="📦" l="Archive chat" o={()=>handleArchive(selected.id)}/><MI i="🔍" l="Search in chat" o={()=>{setShowSearch(!showSearch);setHeaderMenu(false);}}/><div className="h-px bg-white/[0.06] my-0.5"/><MI i="🗑️" l="Delete chat" o={()=>handleDeleteChat(selected.id)} d/></div>}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-12 py-3" style={{backgroundImage:"url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.008'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",backgroundColor:"#0a0e0c"}}>
              {messages.map((msg,i)=>{const isU=msg.role==="user";const reply=msg.reply_to_id?messages.find((m)=>m.id===msg.reply_to_id):null;const sd=showDate(messages,i);return(
                <div key={msg.id}>
                  {sd&&<div className="flex justify-center my-3"><span className="px-3 py-1 rounded-lg bg-[#1a2028] text-[11px] text-white/50 font-medium shadow">{dateLabel(msg.created_at)}</span></div>}
                  <div className={`flex ${isU?"justify-start":"justify-end"} group/msg mb-1 relative`}>
                    <div className={`relative flex flex-col ${isU?"items-start":"items-end"} max-w-[65%]`}>
                      {reply&&<div className={`w-full px-2.5 py-1.5 mb-0.5 rounded-t-lg text-[11px] border-l-[3px] ${isU?"bg-white/[0.04] border-white/20 text-white/50":"bg-emerald-900/30 border-emerald-400/50 text-white/60"}`}><p className="font-semibold text-[10px] text-emerald-400 mb-0.5">{reply.role==="user"?(selected?.name||selected?.phone):"You"}</p><p className="truncate">{reply.content}</p></div>}
                      <div className={`relative px-2.5 py-1.5 text-[13px] ${msg.message_type==="sticker"?"bg-transparent":isU?"bg-[#202c33] text-white/90 rounded-lg rounded-tl-[3px]":"bg-[#005c4b] text-white rounded-lg rounded-tr-[3px]"} ${reply?"rounded-t-none":""}`}>
                        <button onClick={(e)=>{e.stopPropagation();setMsgMenu(msgMenu===msg.id?null:msg.id);}} className="absolute top-1 right-1 w-5 h-5 rounded opacity-0 group-hover/msg:opacity-100 hover:bg-white/10 flex items-center justify-center z-10"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg></button>
                        {renderMedia(msg)}
                        <div className={`flex items-center justify-end gap-0.5 mt-0.5 ${msg.message_type==="sticker"?"bg-black/40 rounded px-1.5 py-0.5 w-fit ml-auto":""}`}>{msg.is_starred&&<span className="text-[9px]">⭐</span>}<span className="text-[10px] text-white/30">{fmtMsgTime(msg.created_at)}</span>{!isU&&statusIcon(msg.status||"sent")}</div>
                      </div>
                      {msg.reaction&&<div className={`absolute -bottom-2.5 ${isU?"left-2":"right-2"} bg-[#1a2028] border border-white/[0.08] rounded-full px-1.5 py-0.5 text-[13px] shadow cursor-pointer hover:scale-110 transition-transform`} onClick={(e)=>{e.stopPropagation();setShowReactionPicker(msg.id);}}>{msg.reaction}</div>}
                      {msgMenu===msg.id&&<div className={`absolute ${isU?"left-0":"right-0"} top-0 z-50 bg-[#233138] rounded-lg shadow-2xl py-1 min-w-[180px] border border-white/[0.08]`} onClick={(e)=>e.stopPropagation()}><MI i="↩️" l="Reply" o={()=>{setReplyTo(msg);setMsgMenu(null);inputRef.current?.focus();}}/><MI i="😀" l="React" o={()=>{setShowReactionPicker(msg.id);setMsgMenu(null);}}/><MI i={msg.is_starred?"⭐":"☆"} l={msg.is_starred?"Unstar":"Star message"} o={()=>handleStar(msg.id,!msg.is_starred)}/><MI i="📋" l="Copy text" o={()=>{navigator.clipboard.writeText(msg.content);setMsgMenu(null);}}/><div className="h-px bg-white/[0.06] my-0.5"/><MI i="🗑️" l="Delete message" o={()=>handleDeleteMsg(msg.id)} d/></div>}
                      {showReactionPicker===msg.id&&<div className={`absolute ${isU?"left-0":"right-0"} -top-11 z-50 bg-[#233138] border border-white/[0.08] rounded-full px-2 py-1.5 flex gap-0.5 shadow-2xl`} onClick={(e)=>e.stopPropagation()}>{QUICK_REACTIONS.map((e)=><button key={e} onClick={()=>handleReact(msg.id,e)} className="text-[18px] hover:scale-125 transition-transform w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center">{e}</button>)}</div>}
                    </div>
                  </div>
                </div>
              );})}
              <div ref={messagesEndRef}/>
            </div>

            {/* Reply Banner */}
            {replyTo&&<div className="px-4 sm:px-12 pt-2" style={{background:"#111"}}><div className="flex items-center gap-3 bg-[#1a2028] border-l-[3px] border-emerald-500 rounded-lg px-3 py-2"><div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-emerald-400">{replyTo.role==="user"?(selected?.name||selected?.phone):"You"}</p><p className="text-[12px] text-white/50 truncate">{replyTo.content}</p></div><button onClick={()=>setReplyTo(null)} className="w-6 h-6 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-white/30 flex-shrink-0">✕</button></div></div>}

            {/* Emoji Picker */}
            {showEmojiPicker&&<div className="mx-4 sm:mx-12 mb-1 bg-[#1a2028] rounded-xl border border-white/[0.08] shadow-2xl overflow-hidden" onClick={(e)=>e.stopPropagation()} style={{maxHeight:320}}>
              <div className="flex border-b border-white/[0.06] overflow-x-auto px-1 py-1 gap-0.5">{Object.keys(EMOJI_CATEGORIES).map((cat)=><button key={cat} onClick={()=>setEmojiCategory(cat)} className={`px-2 py-1.5 text-[13px] rounded-lg flex-shrink-0 transition-colors ${emojiCategory===cat?"bg-emerald-500/20 text-emerald-400":"text-white/40 hover:text-white/70 hover:bg-white/[0.04]"}`}>{cat.split(" ")[0]}</button>)}</div>
              <div className="p-2 overflow-y-auto" style={{maxHeight:240}}><div className="flex flex-wrap gap-0.5">{EMOJI_CATEGORIES[emojiCategory]?.map((em,i)=><button key={i} onClick={()=>{setInput((p)=>p+em);setShowEmojiPicker(false);inputRef.current?.focus();}} className="w-9 h-9 text-[20px] rounded-lg hover:bg-white/[0.08] flex items-center justify-center transition-colors">{em}</button>)}</div></div>
            </div>}

            {/* Input */}
            <div className="px-4 sm:px-12 py-2.5 border-t border-white/[0.06] flex items-center gap-2" style={{background:"#111"}}>
              <button onClick={(e)=>{e.stopPropagation();setShowEmojiPicker(!showEmojiPicker);}} className="w-10 h-10 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-white/35 hover:text-white/60 flex-shrink-0 text-[22px]">😀</button>
              <div className="flex-1 flex items-center bg-[#2a3942] rounded-lg px-4 py-2.5"><input ref={inputRef} type="text" value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&!e.shiftKey&&handleSend()} placeholder="Type a message" className="flex-1 bg-transparent text-[14px] text-white/90 placeholder:text-white/30 focus:outline-none"/></div>
              <button onClick={handleSend} disabled={sending||!input.trim()} className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/15">
                {sending?<svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>:<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Image Preview */}
      {imagePreview&&<div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center" onClick={()=>setImagePreview(null)}><button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl" onClick={()=>setImagePreview(null)}>✕</button><img src={imagePreview} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" onClick={(e)=>e.stopPropagation()}/></div>}
    </div>
  );
}

function MI({i,l,o,d}:{i:string;l:string;o:()=>void;d?:boolean}) {
  return <button onClick={o} className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] transition-colors ${d?"text-red-400 hover:bg-red-500/10":"text-white/85 hover:bg-white/[0.06]"}`}><span className="w-5 text-center">{i}</span><span>{l}</span></button>;
}
