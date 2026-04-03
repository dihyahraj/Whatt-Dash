"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { ConversationWithLastMessage, Message, MessageType, Label, QuickReply } from "@/lib/types";

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

  // ═══ THEME ═══
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    const saved = localStorage.getItem("whattdash-theme") as "light" | "dark" | null;
    const t = saved || "dark";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("whattdash-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

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
  const [sending, setSendingState] = useState(false);
  const setSending = (v: boolean) => { sendingRef.current = v; setSendingState(v); };
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
  const [filter, setFilter] = useState<"all" | "unread" | string>("all");
  const [labels, setLabels] = useState<Label[]>([]);
  const [showLabelMenu, setShowLabelMenu] = useState<string | null>(null);
  const [chatLabelOpen, setChatLabelOpen] = useState<string | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#10b981");
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [forwardSelected, setForwardSelected] = useState<Set<string>>(new Set());
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [qrMode, setQrMode] = useState<"list" | "add" | "edit">("list");
  const [qrTitle, setQrTitle] = useState("");
  const [qrContent, setQrContent] = useState("");
  const [qrCategory, setQrCategory] = useState("");
  const [qrEditId, setQrEditId] = useState<string | null>(null);
  const [qrSearch, setQrSearch] = useState("");
  const [mobileSidebar, setMobileSidebar] = useState(true);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMsg, setHasNewMsg] = useState(false);

  const sel = convos.find((c) => c.id === selId);

  // ═══ FETCH ═══
  const fetchConvos = useCallback(async () => { if (skipPollRef.current) return; try { const r = await fetch("/api/conversations"); if (skipPollRef.current) return; const d = await r.json(); if (skipPollRef.current) return; if (Array.isArray(d)) setConvos(d); } catch {} }, []);
  const sendingRef = useRef(false);
  const lastSentIdsRef = useRef<Set<string>>(new Set());
  const skipPollRef = useRef(false);

  const fetchMsgs = useCallback(async (id: string) => {
    if (sendingRef.current || skipPollRef.current) return;
    try { const r = await fetch(`/api/conversations/${id}/messages`); if (sendingRef.current || skipPollRef.current) return; const d = await r.json(); if (sendingRef.current || skipPollRef.current) return; if (Array.isArray(d)) setMsgs(d); } catch {}
  }, []);
  const fetchArchived = useCallback(async () => { if (skipPollRef.current) return; try { const r = await fetch("/api/conversations/archived"); if (skipPollRef.current) return; const d = await r.json(); if (skipPollRef.current) return; if (Array.isArray(d)) setArchived(d); } catch {} }, []);
  const fetchLabels = useCallback(async () => { try { const r = await fetch("/api/labels"); const d = await r.json(); if (Array.isArray(d)) setLabels(d); } catch {} }, []);
  const fetchQuickReplies = useCallback(async () => { try { const r = await fetch("/api/quick-replies"); const d = await r.json(); if (Array.isArray(d)) setQuickReplies(d); } catch {} }, []);

  async function createQuickReply() {
    if (!qrTitle.trim() || !qrContent.trim()) return;
    try { const r = await fetch("/api/quick-replies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: qrTitle, content: qrContent, category: qrCategory || null }) }); if (r.ok) { fetchQuickReplies(); setQrTitle(""); setQrContent(""); setQrCategory(""); setQrMode("list"); } } catch {}
  }
  async function updateQuickReply() {
    if (!qrEditId || !qrTitle.trim() || !qrContent.trim()) return;
    try { const r = await fetch(`/api/quick-replies/${qrEditId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: qrTitle, content: qrContent, category: qrCategory || null }) }); if (r.ok) { fetchQuickReplies(); setQrTitle(""); setQrContent(""); setQrCategory(""); setQrEditId(null); setQrMode("list"); } } catch {}
  }
  async function deleteQuickReply(id: string) { if (!confirm("Delete this quick reply?")) return; try { await fetch(`/api/quick-replies/${id}`, { method: "DELETE" }); fetchQuickReplies(); } catch {} }
  function useQuickReply(qr: QuickReply) {
    let text = qr.content;
    if (sel) { text = text.replace(/\{name\}/g, sel.name || sel.phone).replace(/\{phone\}/g, sel.phone); }
    setInput(text); setShowQuickReplies(false); inputRef.current?.focus();
    fetch(`/api/quick-replies/${qr.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ use: true }) }).catch(() => {});
  }

  useEffect(() => { fetchConvos(); fetchArchived(); fetchLabels(); fetchQuickReplies(); }, [fetchConvos, fetchArchived, fetchLabels, fetchQuickReplies]);
  useEffect(() => { if (selId) { fetchMsgs(selId); fetch(`/api/conversations/${selId}/read`, { method: "POST" }).catch(() => {}); setConvos((p) => p.map((c) => c.id === selId ? { ...c, unread_count: 0 } : c)); setIsAtBottom(true); } }, [selId, fetchMsgs]);
  useEffect(() => { if (isAtBottom) { endRef.current?.scrollIntoView({ behavior: "smooth" }); setHasNewMsg(false); } else if (msgs.length > 0) { setHasNewMsg(true); } }, [msgs, isAtBottom]);

  function handleScroll() { const el = chatBoxRef.current; if (!el) return; const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80; setIsAtBottom(atBottom); if (atBottom) setHasNewMsg(false); }
  function scrollToBottom() { endRef.current?.scrollIntoView({ behavior: "smooth" }); setIsAtBottom(true); setHasNewMsg(false); }

  useEffect(() => {
    const iv = setInterval(() => { if (skipPollRef.current || sendingRef.current) return; fetchConvos(); if (selId) { fetchMsgs(selId); fetch(`/api/conversations/${selId}/read`, { method: "POST" }).catch(() => {}); setConvos((p) => p.map((c) => c.id === selId ? { ...c, unread_count: 0 } : c)); } }, 2000);
    return () => clearInterval(iv);
  }, [fetchConvos, fetchMsgs, selId]);

  function notifyNewMsg(msg: Message) {
    const c = convos.find((x) => x.id === msg.conversation_id);
    if (c?.is_muted) return;
    const title = c?.name || c?.phone || "New Message";
    const body = msg.content?.substring(0, 100) || "New message";
    if ("Notification" in window && Notification.permission === "granted") { new Notification(title, { body, icon: "/favicon.ico", tag: msg.conversation_id }); }
    try { const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value = 800; gain.gain.value = 0.3; osc.start(); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3); osc.stop(ctx.currentTime + 0.3); } catch {}
  }

  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel("rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as Message;
        if (m.conversation_id === selId) {
          setMsgs((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            if (lastSentIdsRef.current.has(m.id)) return prev;
            const tempIdx = prev.findIndex((x) => x.id.startsWith("temp_") && x.content === m.content && x.role === m.role);
            if (tempIdx >= 0) { const updated = [...prev]; updated[tempIdx] = m; return updated; }
            if (m.role === "assistant" && sendingRef.current) return prev;
            return [...prev, m];
          });
          if (m.role === "user") fetch(`/api/conversations/${selId}/read`, { method: "POST" }).catch(() => {});
        }
        if (m.role === "user") notifyNewMsg(m);
        fetchConvos();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (p) => { const u = p.new as Message; setMsgs((prev) => prev.map((m) => m.id === u.id ? u : m)); })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => fetchConvos())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selId, fetchConvos, supabase]);

  useEffect(() => { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); }, []);
  useEffect(() => { const total = convos.reduce((s, c) => s + (c.unread_count || 0), 0); document.title = total > 0 ? `(${total}) Whatt Dash` : "Whatt Dash"; }, [convos]);

  // ═══ SEND ═══
  async function handleSend() {
    if (!input.trim() || !selId || sending) return;
    const text = input.trim(); const reply = replyTo;
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: Message = { id: tempId, conversation_id: selId, role: "assistant", content: text, message_type: "text", media_url: null, media_mime_type: null, media_filename: null, media_caption: null, media_sha256: null, reply_to_id: reply?.id || null, reaction: null, reaction_msg_id: null, latitude: null, longitude: null, location_name: null, location_address: null, whatsapp_msg_id: null, is_deleted: false, is_starred: false, status: "sent", created_at: new Date().toISOString() };
    setMsgs((p) => [...p, optimisticMsg]); setInput(""); setReplyTo(null);
    if (inputRef.current) inputRef.current.style.height = "auto";
    setIsAtBottom(true); setSending(true);
    try {
      const b: Record<string, string> = { message: text };
      if (reply) { b.replyToMsgId = reply.id; if (reply.whatsapp_msg_id) b.replyToWhatsappId = reply.whatsapp_msg_id; }
      const r = await fetch(`/api/conversations/${selId}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
      if (!r.ok) { setMsgs((p) => p.filter((m) => m.id !== tempId)); const d = await r.json(); alert("Error:\n" + JSON.stringify(d, null, 2)); setInput(text); return; }
      const real = await r.json(); lastSentIdsRef.current.add(real.id); setMsgs((p) => p.map((m) => m.id === tempId ? { ...real } : m));
      setTimeout(() => { setSending(false); setTimeout(() => { lastSentIdsRef.current.delete(real.id); }, 10000); }, 3000);
    } catch (e) { setMsgs((p) => p.filter((m) => m.id !== tempId)); setInput(text); alert("Network Error: " + String(e)); setSending(false); }
  }

  // ═══ CHAT ACTIONS ═══
  function closeMenus() { setChatMenuId(null); setHeaderMenu(false); setMsgMenuId(null); }
  function pausePoll(ms = 4000) { skipPollRef.current = true; setTimeout(() => { skipPollRef.current = false; }, ms); }

  async function act(url: string, body?: object) {
    closeMenus(); pausePoll();
    if (body && typeof body === "object") {
      const b = body as Record<string, unknown>;
      const cid = url.match(/conversations\/([^/]+)\//)?.[1];
      if ("archived" in b && b.archived) {
        const chat = convos.find((c) => c.id === cid);
        setConvos((p) => p.filter((c) => c.id !== cid));
        if (chat) setArchived((p) => [{ ...chat, is_archived: true }, ...p]);
        if (selId === cid) { setSelId(null); setMsgs([]); }
      } else {
        setConvos((p) => p.map((c) => {
          if (c.id !== cid) return c;
          if ("pinned" in b) return { ...c, is_pinned: !!b.pinned };
          if ("muted" in b) return { ...c, is_muted: !!b.muted };
          if ("unread_count" in b) return { ...c, unread_count: b.unread_count as number };
          return c;
        }));
      }
    }
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).catch(() => {});
  }

  async function delChat(id: string) {
    if (!confirm("Are you sure you want to delete this chat?")) return;
    closeMenus(); pausePoll();
    setConvos((p) => p.filter((c) => c.id !== id)); setArchived((p) => p.filter((c) => c.id !== id));
    if (selId === id) { setSelId(null); setMsgs([]); }
    fetch(`/api/conversations/${id}/delete`, { method: "POST" }).catch(() => {});
  }
  async function unarchive(id: string) {
    pausePoll(); const chat = archived.find((c) => c.id === id); setArchived((p) => p.filter((c) => c.id !== id));
    if (chat) setConvos((p) => [{ ...chat, is_archived: false }, ...p]);
    fetch(`/api/conversations/${id}/archive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: false }) }).catch(() => {});
  }
  async function starMsg(id: string, v: boolean) { pausePoll(); setMsgs((p) => p.map((m) => m.id === id ? { ...m, is_starred: v } : m)); setMsgMenuId(null); fetch(`/api/messages/${id}/star`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starred: v }) }).catch(() => {}); }
  async function reactMsg(msgId: string, emoji: string) {
    if (!selId) return; pausePoll(); const m = msgs.find((x) => x.id === msgId); const newEmoji = m?.reaction === emoji ? "" : emoji;
    setMsgs((p) => p.map((x) => x.id === msgId ? { ...x, reaction: newEmoji || null } : x)); setReactPickerId(null);
    fetch(`/api/conversations/${selId}/react`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: msgId, emoji: newEmoji, whatsappMsgId: m?.whatsapp_msg_id || null }) }).catch(() => {});
  }
  async function createLabel() {
    if (!newLabelName.trim()) return; pausePoll();
    const tempLabel = { id: `temp_${Date.now()}`, name: newLabelName.trim(), color: newLabelColor }; setLabels((p) => [...p, tempLabel]); setNewLabelName("");
    fetch("/api/labels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: tempLabel.name, color: tempLabel.color }) }).then(() => fetchLabels()).catch(() => {});
  }
  async function deleteLabel(id: string) { if (!confirm("Delete this label?")) return; pausePoll(); setLabels((p) => p.filter((l) => l.id !== id)); fetch(`/api/labels/${id}`, { method: "DELETE" }).then(() => { fetchLabels(); fetchConvos(); }).catch(() => {}); }
  async function toggleLabel(convoId: string, labelId: string, has: boolean) {
    pausePoll(); const label = labels.find((l) => l.id === labelId);
    if (label) { setConvos((p) => p.map((c) => { if (c.id !== convoId) return c; const newLabels = has ? c.labels.filter((l) => l.id !== labelId) : [...c.labels, label]; return { ...c, labels: newLabels }; })); }
    setShowLabelMenu(null); fetch(`/api/conversations/${convoId}/labels`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label_id: labelId, action: has ? "remove" : "add" }) }).catch(() => {});
  }
  async function forwardMessage(msgId: string, targetIds: string[]) {
    if (targetIds.length === 0) return;
    await fetch(`/api/messages/${msgId}/forward`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetConversationIds: targetIds }) });
    setForwardMsg(null); setForwardSelected(new Set()); fetchConvos();
  }
  function saveContact(convoId: string) { window.open(`/api/conversations/${convoId}/save-contact`, "_blank"); }
  function downloadContactsCsv() { window.open("/api/contacts/export", "_blank"); }

  function addOptimisticMsg(tempId: string, content: string, type: string = "text") {
    if (!selId) return;
    const msg: Message = { id: tempId, conversation_id: selId, role: "assistant", content, message_type: type as Message["message_type"], media_url: null, media_mime_type: null, media_filename: null, media_caption: null, media_sha256: null, reply_to_id: null, reaction: null, reaction_msg_id: null, latitude: null, longitude: null, location_name: null, location_address: null, whatsapp_msg_id: null, is_deleted: false, is_starred: false, status: "sent", created_at: new Date().toISOString() };
    setMsgs((p) => [...p, msg]); setIsAtBottom(true);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setReplyTo(null); setChatMenuId(null); setMsgMenuId(null); setReactPickerId(null); setShowEmoji(false); setHeaderMenu(false); setImgPreview(null); setShowChatSearch(false); setChatLabelOpen(null); setShowLabelMenu(null); setForwardMsg(null); setForwardSelected(new Set()); } };
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h);
  }, []);

  // ═══ HELPERS ═══
  function ft(d: string) { const t = new Date(d), n = new Date(), df = n.getTime() - t.getTime(); if (df < 86400000 && t.getDate() === n.getDate()) return t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); if (df < 172800000) return "Yesterday"; if (df < 604800000) return t.toLocaleDateString([], { weekday: "short" }); return t.toLocaleDateString([], { month: "short", day: "numeric" }); }
  function mt(d: string) { return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  function ini(n: string | null, p: string) { if (n) { const s = n.trim().split(/\s+/); return s.length >= 2 ? (s[0][0] + s[1][0]).toUpperCase() : n.slice(0, 2).toUpperCase(); } return p.slice(-2); }
  function aclr(id: string) { const c = ["from-emerald-500 to-teal-700","from-blue-500 to-indigo-700","from-purple-500 to-violet-700","from-orange-500 to-red-700","from-pink-500 to-rose-700","from-cyan-500 to-blue-700","from-amber-500 to-orange-700","from-lime-500 to-green-700"]; let h = 0; for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h); return c[Math.abs(h) % c.length]; }
  function lmp(c: ConversationWithLastMessage) { const p = c.last_message_role === "assistant" ? "✓ " : ""; const ic: Partial<Record<MessageType, string>> = { image: "📷 Photo", video: "🎥 Video", audio: "🎵 Audio", document: "📄 Document", sticker: "🏷️ Sticker", location: "📍 Location", contacts: "📇 Contact" }; if (c.last_message_type && c.last_message_type !== "text" && ic[c.last_message_type]) return p + ic[c.last_message_type]; return p + (c.last_message || ""); }
  function si(s: string) {
    if (s === "sent") return <span className="material-symbols-rounded inline ml-1" style={{ fontSize: 14, color: "var(--text-tertiary)" }}>check</span>;
    if (s === "delivered") return <span className="material-symbols-rounded inline ml-1" style={{ fontSize: 14, color: "var(--text-tertiary)" }}>done_all</span>;
    if (s === "read") return <span className="material-symbols-rounded inline ml-1" style={{ fontSize: 14, color: "var(--status-read)" }}>done_all</span>;
    return null;
  }
  function dl(d: string) { const t = new Date(d), n = new Date(); if (t.toDateString() === n.toDateString()) return "Today"; const y = new Date(n); y.setDate(y.getDate()-1); if (t.toDateString() === y.toDateString()) return "Yesterday"; return t.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }
  function sd(m: Message[], i: number) { return i === 0 || new Date(m[i].created_at).toDateString() !== new Date(m[i-1].created_at).toDateString(); }

  const filtered = convos.filter((c) => {
    if (search) { const q = search.toLowerCase(); if (!(c.name?.toLowerCase().includes(q) || c.phone.includes(q) || c.last_message?.toLowerCase().includes(q))) return false; }
    if (filter === "unread") return c.unread_count > 0;
    if (filter !== "all") return c.labels?.some((l: Label) => l.id === filter);
    return true;
  });
  const displayMsgs = chatSearch ? msgs.filter((m) => m.content?.toLowerCase().includes(chatSearch.toLowerCase())) : msgs;

  // ═══ MEDIA RENDERER ═══
  function media(msg: Message) {
    if (msg.is_deleted) return <p className="italic text-[13px]" style={{ color: "var(--text-tertiary)" }}>🚫 This message was deleted</p>;
    switch (msg.message_type) {
      case "image": return (<div>{msg.media_url && <img src={msg.media_url} alt="Photo" className="rounded-xl max-w-[260px] max-h-[300px] object-cover cursor-pointer hover:brightness-90 transition-all" onClick={() => setImgPreview(msg.media_url)}/>}{msg.media_caption && msg.media_caption !== "[image]" && <p className="text-[13px] mt-1.5 whitespace-pre-wrap select-text cursor-text">{msg.media_caption}</p>}</div>);
      case "video": return (<div>{msg.media_url ? <video controls className="rounded-xl max-w-[260px]" preload="metadata"><source src={msg.media_url} type={msg.media_mime_type || "video/mp4"}/></video> : <span className="text-[13px]">🎥 Video</span>}{msg.media_caption && <p className="text-[13px] mt-1.5 select-text cursor-text">{msg.media_caption}</p>}</div>);
      case "audio": return msg.media_url ? <audio controls className="max-w-[240px]" preload="metadata"><source src={msg.media_url} type={msg.media_mime_type || "audio/ogg"}/></audio> : <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-secondary)" }}><div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "var(--md-primary)" }}/><span>Sending voice...</span></div>;
      case "document": return (<a href={msg.media_url || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-xl p-3 min-w-[200px] transition-colors" style={{ background: "var(--ripple)" }}><div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--ripple)" }}><span className="material-symbols-rounded" style={{ fontSize: 22, color: "var(--md-primary)" }}>description</span></div><div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate">{msg.media_filename || "Document"}</p><p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{msg.media_mime_type || "File"} • Tap to open</p></div><span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 18, color: "var(--text-tertiary)" }}>open_in_new</span></a>);
      case "sticker": return msg.media_url ? <img src={msg.media_url} alt="" className="w-[120px] h-[120px] object-contain"/> : <span className="text-4xl">🏷️</span>;
      case "location": return (<a href={`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`} target="_blank" rel="noreferrer" className="block rounded-xl p-3 min-w-[180px] transition-colors" style={{ background: "var(--ripple)" }}><p className="text-[13px] font-medium">📍 {msg.location_name || "Location"}</p>{msg.location_address && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{msg.location_address}</p>}<p className="text-[11px] mt-1" style={{ color: "var(--md-primary)" }}>Open in Maps →</p></a>);
      default: return <p className="text-[13px] whitespace-pre-wrap break-words leading-[1.5] select-text cursor-text">{msg.content}</p>;
    }
  }

  // ═══ CHAT MENU ═══
  function ChatMenu({ convo, onClose }: { convo: ConversationWithLastMessage; onClose: () => void }) {
    const labelsOpen = chatLabelOpen === convo.id;
    return (
      <div className="absolute right-2 top-full mt-1 z-[100] rounded-2xl py-1.5 min-w-[200px] animate-scale-in" style={{ background: "var(--md-surface-container-high)", boxShadow: "var(--md-elevation-3)", border: "1px solid var(--divider)" }} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        <MI i="push_pin" l={convo.is_pinned ? "Unpin chat" : "Pin chat"} o={() => { act(`/api/conversations/${convo.id}/pin`, { pinned: !convo.is_pinned }); onClose(); }}/>
        <MI i={convo.is_muted ? "notifications_active" : "notifications_off"} l={convo.is_muted ? "Unmute" : "Mute"} o={() => { act(`/api/conversations/${convo.id}/mute`, { muted: !convo.is_muted }); onClose(); }}/>
        <MI i="mark_email_unread" l="Mark as unread" o={() => { act(`/api/conversations/${convo.id}/unread`, { unread_count: 1 }); onClose(); }}/>
        <MI i="contact_page" l="Save contact" o={() => { saveContact(convo.id); onClose(); }}/>
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setChatLabelOpen(labelsOpen ? null : convo.id); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] transition-colors" style={{ color: "var(--md-on-surface)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>label</span><span>Labels</span>
          <span className={`material-symbols-rounded transition-transform ${labelsOpen ? "rotate-180" : ""}`} style={{ fontSize: 14, marginLeft: "auto" }}>expand_more</span>
        </button>
        {labelsOpen && (
          <div className="px-2 py-1.5" style={{ borderTop: "1px solid var(--divider)" }} onClick={(e) => e.stopPropagation()}>
            {labels.map((l) => {
              const has = convo.labels?.some((cl: Label) => cl.id === l.id);
              return (
                <button key={l.id} onClick={(e) => { e.stopPropagation(); toggleLabel(convo.id, l.id, !!has); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] transition-colors" onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <span className="w-3 h-3 rounded-full flex-shrink-0 border-2" style={{ background: has ? l.color : "transparent", borderColor: l.color }}/><span style={{ color: has ? "var(--md-on-surface)" : "var(--text-secondary)" }}>{l.name}</span>
                </button>
              );
            })}
            {labels.length === 0 && <p className="text-[11px] px-2 py-1" style={{ color: "var(--text-tertiary)" }}>No labels yet</p>}
          </div>
        )}
        <MI i="archive" l="Archive" o={() => { act(`/api/conversations/${convo.id}/archive`, { archived: true }); onClose(); }}/>
        {user?.role === "admin" && <><div style={{ height: 1, background: "var(--divider)", margin: "4px 0" }}/><MI i="delete" l="Delete chat" o={() => { delChat(convo.id); onClose(); }} d/></>}
      </div>
    );
  }

  // ═══ AUTH GATES ═══
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--md-surface)" }}>
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--md-primary)" }}>
          <span className="material-symbols-rounded text-white" style={{ fontSize: 28, fontVariationSettings: "'FILL' 1" }}>chat</span>
        </div>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--md-primary)", borderTopColor: "transparent" }}/>
      </div>
    </div>
  );
  if (!user) { window.location.href = "/login"; return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--md-surface)" }}><p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Redirecting...</p></div>; }

  // ═══ JSX ═══
  return (
    <div className="flex h-screen overflow-hidden select-none" style={{ background: "var(--md-surface)" }}>

      {/* ════════════ SIDEBAR ════════════ */}
      <div className={`${mobileSidebar && selId ? "hidden md:flex" : "flex"} w-full md:w-[380px] flex-col flex-shrink-0`} style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--divider)" }}>

        {/* Sidebar Header */}
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--divider)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "var(--md-primary)" }}>
                <span className="material-symbols-rounded text-white" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }}>chat</span>
              </div>
              <div>
                <h1 className="text-[15px] font-bold tracking-tight" style={{ color: "var(--md-on-surface)" }}>Whatt Dash</h1>
                <p className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>{user.display_name} · {convos.length} chats</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {/* Theme toggle */}
              <button onClick={toggleTheme} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"} title={theme === "dark" ? "Light mode" : "Dark mode"}>
                <span className="material-symbols-rounded" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>{theme === "dark" ? "light_mode" : "dark_mode"}</span>
              </button>
              {user?.role === "admin" && <button onClick={() => router.push("/admin")} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"} title="Manage Users"><span className="material-symbols-rounded" style={{ fontSize: 20 }}>group</span></button>}
              <button onClick={() => setShowSearch(!showSearch)} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}><span className="material-symbols-rounded" style={{ fontSize: 20 }}>search</span></button>
              {user?.role === "admin" && <button onClick={downloadContactsCsv} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"} title="Export CSV"><span className="material-symbols-rounded" style={{ fontSize: 20 }}>download</span></button>}
              <button onClick={signOut} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"} title="Sign Out"><span className="material-symbols-rounded" style={{ fontSize: 20 }}>logout</span></button>
            </div>
          </div>
          {showSearch && (
            <div className="relative mt-3 animate-slide-up">
              <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2" style={{ fontSize: 18, color: "var(--text-tertiary)" }}>search</span>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations..." className="w-full rounded-xl pl-10 pr-4 py-2.5 text-[13px] focus:outline-none" style={{ background: "var(--md-surface-container)", color: "var(--md-on-surface)", border: "1px solid var(--divider)" }} autoFocus/>
            </div>
          )}
        </div>

        {/* Filter Chips — M3 style */}
        <div className="px-3 py-2.5 flex gap-2 overflow-x-auto" style={{ borderBottom: "1px solid var(--divider)" }}>
          {[{ id: "all", label: "All" }, { id: "unread", label: "Unread" }].map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium flex-shrink-0 transition-all" style={{ background: filter === f.id ? "var(--md-primary)" : "var(--md-surface-container)", color: filter === f.id ? "var(--md-on-primary)" : "var(--text-secondary)" }}>{f.label}</button>
          ))}
          {labels.map((l) => (
            <button key={l.id} onClick={() => setFilter(filter === l.id ? "all" : l.id)} className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium flex-shrink-0 transition-all flex items-center gap-1.5" style={{ background: filter === l.id ? "var(--md-primary)" : "var(--md-surface-container)", color: filter === l.id ? "var(--md-on-primary)" : "var(--text-secondary)" }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }}/>{l.name}
            </button>
          ))}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <div className="flex flex-col items-center justify-center h-48 text-xs" style={{ color: "var(--text-tertiary)" }}>{search ? "No results found" : "No conversations yet"}</div>}
          {filtered.map((c) => {
            const isSel = selId === c.id;
            return (
              <div key={c.id} className="relative transition-colors" style={{ background: isSel ? "var(--sidebar-selected)" : "transparent" }} onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "var(--sidebar-hover)"; }} onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
                <div className="flex items-center px-3 py-3 cursor-pointer gap-3" onClick={() => { setSelId(c.id); setChatMenuId(null); setMobileSidebar(false); }}>
                  <div className={`w-[48px] h-[48px] rounded-2xl bg-gradient-to-br ${aclr(c.id)} flex items-center justify-center flex-shrink-0 text-white text-[14px] font-bold`}>{ini(c.name, c.phone)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] truncate" style={{ fontWeight: c.unread_count > 0 ? 700 : 500, color: "var(--md-on-surface)" }}>{c.name || c.phone}</span>
                      <span className="text-[11px] flex-shrink-0 ml-2" style={{ color: c.unread_count > 0 ? "var(--md-primary)" : "var(--text-tertiary)" }}>{ft(c.last_message_time || c.updated_at)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[12px] truncate flex-1 min-w-0" style={{ color: c.unread_count > 0 ? "var(--text-secondary)" : "var(--text-tertiary)" }}>{lmp(c)}</p>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {c.labels?.map((l: Label) => <span key={l.id} className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }} title={l.name}/>)}
                        {c.is_pinned && <span className="text-[10px]">📌</span>}
                        {c.is_muted && <span className="text-[10px]">🔕</span>}
                        {c.unread_count > 0 && <span className="min-w-[20px] h-[20px] rounded-full text-[10px] font-bold flex items-center justify-center px-1.5" style={{ background: "var(--md-primary)", color: "var(--badge-text)" }}>{c.unread_count}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="relative flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setChatMenuId(chatMenuId === c.id ? null : c.id); setMsgMenuId(null); setHeaderMenu(false); }} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors" style={{ color: "var(--text-tertiary)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>more_vert</span>
                    </button>
                    {chatMenuId === c.id && <ChatMenu convo={c} onClose={() => setChatMenuId(null)}/>}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Archived */}
          {archived.length > 0 && (
            <div style={{ borderTop: "1px solid var(--divider)" }}>
              <button onClick={async () => { setShowArchived(!showArchived); if (!showArchived) { try { const r = await fetch("/api/conversations/archived"); const d = await r.json(); if (Array.isArray(d)) setArchived(d); } catch {} } }} className="w-full flex items-center gap-3 px-4 py-3 transition-colors" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--sidebar-hover)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <span className="material-symbols-rounded" style={{ fontSize: 20 }}>archive</span>
                <span className="text-[13px] font-medium">Archived ({archived.length})</span>
                <span className={`material-symbols-rounded transition-transform ${showArchived ? "rotate-180" : ""}`} style={{ fontSize: 16, marginLeft: "auto" }}>expand_more</span>
              </button>
              {showArchived && archived.map((ac) => (
                <div key={ac.id} className="flex items-center px-3 py-2.5" onMouseEnter={(e) => e.currentTarget.style.background = "var(--sidebar-hover)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${aclr(ac.id)} flex items-center justify-center flex-shrink-0 text-white text-[12px] font-bold opacity-60`}>{ini(ac.name, ac.phone)}</div>
                  <div className="flex-1 min-w-0 ml-3 cursor-pointer" onClick={() => { setSelId(ac.id); setMobileSidebar(false); }}>
                    <span className="text-[13px] truncate block" style={{ color: "var(--text-secondary)" }}>{ac.name || ac.phone}</span>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>{lmp(ac)}</p>
                  </div>
                  <div className="flex gap-1.5 ml-2 flex-shrink-0">
                    <button onClick={() => unarchive(ac.id)} className="px-2.5 py-1 text-[11px] rounded-lg font-medium transition-colors" style={{ background: "var(--md-primary-container)", color: "var(--md-on-primary-container)" }}>Unarchive</button>
                    {user?.role === "admin" && <button onClick={() => delChat(ac.id)} className="px-2.5 py-1 text-[11px] rounded-lg font-medium transition-colors" style={{ background: "var(--md-error-container)", color: "var(--md-error)" }}>Delete</button>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Labels Management */}
          <div style={{ borderTop: "1px solid var(--divider)" }}>
            <div className="px-4 py-3">
              <p className="text-[11px] font-semibold mb-2.5 tracking-wider" style={{ color: "var(--text-tertiary)" }}>LABELS</p>
              <div className="flex gap-1.5 mb-2.5">
                <input type="text" value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)} placeholder="New label..." onKeyDown={(e) => e.key === "Enter" && createLabel()} className="flex-1 rounded-lg px-3 py-2 text-[12px] focus:outline-none min-w-0" style={{ background: "var(--md-surface-container)", color: "var(--md-on-surface)", border: "1px solid var(--divider)" }}/>
                <input type="color" value={newLabelColor} onChange={(e) => setNewLabelColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"/>
                <button onClick={createLabel} disabled={!newLabelName.trim()} className="px-3 py-2 rounded-lg text-[11px] font-bold disabled:opacity-30 transition-colors" style={{ background: "var(--md-primary)", color: "var(--md-on-primary)" }}>+</button>
              </div>
              {labels.map((l) => (
                <div key={l.id} className="flex items-center gap-2 py-1.5 group/label">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: l.color }}/>
                  <span className="text-[12px] flex-1" style={{ color: "var(--text-secondary)" }}>{l.name}</span>
                  {user?.role === "admin" && <button onClick={() => deleteLabel(l.id)} className="text-[10px] opacity-0 group-hover/label:opacity-60 hover:!opacity-100 transition-opacity" style={{ color: "var(--md-error)" }}>✕</button>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════ CHAT AREA ════════════ */}
      <div className={`flex-1 flex flex-col min-w-0 ${!mobileSidebar || !selId ? "" : ""} ${mobileSidebar && selId ? "flex" : "hidden md:flex"}`}>
        {!sel ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5" style={{ background: "var(--md-surface)" }}>
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center" style={{ background: "var(--md-surface-container)" }}>
              <span className="material-symbols-rounded" style={{ fontSize: 40, color: "var(--text-tertiary)", fontVariationSettings: "'FILL' 1" }}>forum</span>
            </div>
            <div className="text-center">
              <p className="text-[16px] font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Welcome to Whatt Dash</p>
              <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>Select a conversation to start messaging</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--md-surface-container-low)", borderBottom: "1px solid var(--divider)" }}>
              <div className="flex items-center gap-3">
                {/* Mobile back button */}
                <button onClick={() => { setSelId(null); setMobileSidebar(true); }} className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center" style={{ color: "var(--md-on-surface)" }}><span className="material-symbols-rounded" style={{ fontSize: 22 }}>arrow_back</span></button>
                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${aclr(sel.id)} flex items-center justify-center text-white text-sm font-bold`}>{ini(sel.name, sel.phone)}</div>
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--md-on-surface)" }}>{sel.name || sel.phone}</h2>
                  <p className="text-[11px] font-mono" style={{ color: "var(--text-tertiary)" }}>{sel.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={() => { setShowChatSearch(!showChatSearch); setChatSearch(""); }} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}><span className="material-symbols-rounded" style={{ fontSize: 20 }}>search</span></button>
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setHeaderMenu(!headerMenu); setChatMenuId(null); setMsgMenuId(null); }} className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <span className="material-symbols-rounded" style={{ fontSize: 20 }}>more_vert</span>
                  </button>
                  {headerMenu && (
                    <div className="absolute right-0 top-full mt-1 z-[100] rounded-2xl py-2 min-w-[200px] animate-scale-in" style={{ background: "var(--md-surface-container-high)", boxShadow: "var(--md-elevation-3)", border: "1px solid var(--divider)" }} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                      <MI i="push_pin" l={sel.is_pinned ? "Unpin chat" : "Pin chat"} o={() => act(`/api/conversations/${sel.id}/pin`, { pinned: !sel.is_pinned })}/>
                      <MI i={sel.is_muted ? "notifications_active" : "notifications_off"} l={sel.is_muted ? "Unmute" : "Mute"} o={() => act(`/api/conversations/${sel.id}/mute`, { muted: !sel.is_muted })}/>
                      <MI i="mark_email_unread" l="Mark as unread" o={() => act(`/api/conversations/${sel.id}/unread`, { unread_count: 1 })}/>
                      <MI i="contact_page" l="Save contact" o={() => { saveContact(sel.id); setHeaderMenu(false); }}/>
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLabelMenu(showLabelMenu === sel.id ? null : sel.id); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] transition-colors" style={{ color: "var(--md-on-surface)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>label</span><span>Labels</span>
                        <span className={`material-symbols-rounded transition-transform ${showLabelMenu === sel.id ? "rotate-180" : ""}`} style={{ fontSize: 14, marginLeft: "auto" }}>expand_more</span>
                      </button>
                      {showLabelMenu === sel.id && (
                        <div className="px-2 py-1.5" style={{ borderTop: "1px solid var(--divider)" }} onClick={(e) => e.stopPropagation()}>
                          {labels.map((l) => {
                            const has = sel.labels?.some((cl: Label) => cl.id === l.id);
                            return (
                              <button key={l.id} onClick={(e) => { e.stopPropagation(); toggleLabel(sel.id, l.id, !!has); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] transition-colors" onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                <span className="w-3 h-3 rounded-full flex-shrink-0 border-2" style={{ background: has ? l.color : "transparent", borderColor: l.color }}/><span style={{ color: has ? "var(--md-on-surface)" : "var(--text-secondary)" }}>{l.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <MI i="archive" l="Archive" o={() => { act(`/api/conversations/${sel.id}/archive`, { archived: true }); if (selId === sel.id) { setSelId(null); setMsgs([]); } }}/>
                      {user?.role === "admin" && <><div style={{ height: 1, background: "var(--divider)", margin: "4px 0" }}/><MI i="delete" l="Delete chat" o={() => delChat(sel.id)} d/></>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chat Search Bar */}
            {showChatSearch && (
              <div className="px-4 py-2.5 flex items-center gap-2 animate-slide-up" style={{ background: "var(--md-surface-container-low)", borderBottom: "1px solid var(--divider)" }}>
                <span className="material-symbols-rounded" style={{ fontSize: 18, color: "var(--text-tertiary)" }}>search</span>
                <input type="text" value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} placeholder="Search in chat..." className="flex-1 bg-transparent text-[13px] focus:outline-none" style={{ color: "var(--md-on-surface)" }} autoFocus/>
                <button onClick={() => { setShowChatSearch(false); setChatSearch(""); }} className="text-sm" style={{ color: "var(--text-tertiary)" }}>✕</button>
              </div>
            )}

            {/* Messages */}
            <div ref={chatBoxRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 sm:px-16 py-4 relative" style={{ background: "var(--chat-bg)" }}>
              {displayMsgs.map((msg, i) => {
                const isMe = msg.role === "assistant";
                const replied = msg.reply_to_id ? msgs.find((m) => m.id === msg.reply_to_id) : null;
                return (
                  <div key={msg.id}>
                    {sd(displayMsgs, i) && <div className="flex justify-center my-4"><span className="px-4 py-1.5 rounded-xl text-[11px] font-medium" style={{ background: "var(--md-surface-container-high)", color: "var(--text-secondary)", boxShadow: "var(--md-elevation-1)" }}>{dl(msg.created_at)}</span></div>}
                    <div className={`flex ${isMe ? "justify-end" : "justify-start"} ${msg.reaction ? "mb-5" : "mb-[3px]"} group/m`}>
                      <div className="relative max-w-[65%]">
                        {replied && <div className="px-3 py-2 rounded-t-2xl text-[11px]" style={{ background: isMe ? "var(--chat-bubble-me)" : "var(--chat-bubble-them)", borderLeft: `3px solid var(--md-primary)`, opacity: 0.8 }}><p className="font-semibold text-[10px]" style={{ color: "var(--md-primary)" }}>{replied.role === "user" ? (sel?.name || sel?.phone) : "You"}</p><p className="truncate" style={{ color: "var(--text-secondary)" }}>{replied.content}</p></div>}
                        <div className={`relative px-3 py-2 ${msg.message_type === "sticker" ? "bg-transparent" : ""} ${replied ? "rounded-b-2xl" : "rounded-2xl"}`} style={msg.message_type === "sticker" ? {} : { background: isMe ? "var(--chat-bubble-me)" : "var(--chat-bubble-them)", color: isMe ? "var(--chat-bubble-me-text)" : "var(--chat-bubble-them-text)", boxShadow: "var(--md-elevation-1)", ...(isMe ? { borderTopRightRadius: replied ? undefined : "6px" } : { borderTopLeftRadius: replied ? undefined : "6px" }) }}>
                          {!msg.is_deleted && <div className="absolute right-0 top-0 opacity-0 group-hover/m:opacity-100 z-10">
                            <button onClick={(e) => { e.stopPropagation(); setMsgMenuId(msgMenuId === msg.id ? null : msg.id); setChatMenuId(null); setHeaderMenu(false); }} className="w-7 h-7 rounded-bl-xl flex items-center justify-center transition-colors" style={{ background: isMe ? "var(--chat-bubble-me)" : "var(--chat-bubble-them)" }}>
                              <span className="material-symbols-rounded" style={{ fontSize: 16, color: "var(--text-secondary)" }}>expand_more</span>
                            </button>
                          </div>}
                          {media(msg)}
                          <div className="flex items-center justify-end gap-0.5 mt-0.5">
                            {msg.is_starred && <span className="text-[9px]">⭐</span>}
                            <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{mt(msg.created_at)}</span>
                            {isMe && si(msg.status || "sent")}
                          </div>
                        </div>
                        {msg.reaction && <div className="absolute -bottom-3 rounded-full px-1.5 py-0.5 text-[12px] cursor-pointer hover:scale-110 transition-transform" style={{ ...(isMe ? { right: 8 } : { left: 8 }), background: "var(--md-surface-container-high)", boxShadow: "var(--md-elevation-1)", border: "1px solid var(--divider)" }} onClick={(e) => { e.stopPropagation(); reactMsg(msg.id, msg.reaction!); }} title="Click to remove">{msg.reaction}</div>}
                        {/* Msg Menu */}
                        {msgMenuId === msg.id && (() => { const isNearBottom = i >= displayMsgs.length - 3; return (
                          <div className={`absolute ${isMe ? "right-0" : "left-0"} ${isNearBottom ? "bottom-8" : "top-8"} z-[100] rounded-2xl py-1.5 min-w-[180px] animate-scale-in`} style={{ background: "var(--md-surface-container-high)", boxShadow: "var(--md-elevation-3)", border: "1px solid var(--divider)" }} onClick={(e) => e.stopPropagation()}>
                            <MI i="reply" l="Reply" o={() => { setReplyTo(msg); setMsgMenuId(null); inputRef.current?.focus(); }}/>
                            <MI i="add_reaction" l="React" o={() => { setReactPickerId(msg.id); setMsgMenuId(null); }}/>
                            <MI i={msg.is_starred ? "star" : "star_outline"} l={msg.is_starred ? "Unstar" : "Star"} o={() => starMsg(msg.id, !msg.is_starred)}/>
                            <MI i="content_copy" l="Copy" o={() => { navigator.clipboard.writeText(msg.content); setMsgMenuId(null); }}/>
                            <MI i="forward" l="Forward" o={() => { setForwardMsg(msg); setForwardSelected(new Set()); setMsgMenuId(null); }}/>
                          </div>
                        ); })()}
                        {reactPickerId === msg.id && (
                          <div className={`absolute ${isMe ? "right-0" : "left-0"} -top-12 z-[100] rounded-full px-2.5 py-1.5 flex gap-0.5 animate-scale-in`} style={{ background: "var(--md-surface-container-highest)", boxShadow: "var(--md-elevation-3)", border: "1px solid var(--divider)" }} onClick={(e) => e.stopPropagation()}>
                            {QUICK_REACT.map((e) => <button key={e} onClick={() => reactMsg(msg.id, e)} className="text-[18px] hover:scale-125 transition-transform w-8 h-8 rounded-full flex items-center justify-center" onMouseEnter={(ev) => ev.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}>{e}</button>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef}/>
            </div>

            {/* Scroll to bottom */}
            {!isAtBottom && (
              <div className="relative">
                <button onClick={scrollToBottom} className="absolute right-6 -top-14 w-10 h-10 rounded-full flex items-center justify-center z-20 transition-colors" style={{ background: "var(--md-surface-container-high)", boxShadow: "var(--md-elevation-2)", border: "1px solid var(--divider)" }}>
                  {hasNewMsg && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: "var(--md-primary)", color: "var(--badge-text)" }}>!</span>}
                  <span className="material-symbols-rounded" style={{ fontSize: 18, color: "var(--md-on-surface)" }}>expand_more</span>
                </button>
              </div>
            )}

            {/* Reply Bar */}
            {replyTo && (
              <div className="px-4 sm:px-16 pt-2.5" style={{ background: "var(--md-surface-container-low)" }}>
                <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "var(--md-surface-container)", borderLeft: "3px solid var(--md-primary)" }}>
                  <div className="flex-1 min-w-0"><p className="text-[11px] font-bold" style={{ color: "var(--md-primary)" }}>{replyTo.role === "user" ? (sel?.name || sel?.phone) : "You"}</p><p className="text-[12px] truncate" style={{ color: "var(--text-secondary)" }}>{replyTo.content}</p></div>
                  <button onClick={() => setReplyTo(null)} className="text-lg" style={{ color: "var(--text-tertiary)" }}>✕</button>
                </div>
              </div>
            )}

            {/* Emoji Picker */}
            {showEmoji && (
              <div className="mx-4 sm:mx-16 mb-1 rounded-2xl overflow-hidden animate-scale-in" style={{ background: "var(--md-surface-container-high)", boxShadow: "var(--md-elevation-3)", border: "1px solid var(--divider)", maxHeight: 280 }} onClick={(e) => e.stopPropagation()}>
                <div className="flex px-2 py-1.5 gap-1" style={{ borderBottom: "1px solid var(--divider)" }}>
                  {Object.keys(EMOJIS).map((c) => <button key={c} onClick={() => setEmojiCat(c)} className="text-[18px] w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center transition-colors" style={{ background: emojiCat === c ? "var(--md-primary-container)" : "transparent" }}>{c}</button>)}
                </div>
                <div className="p-2 overflow-y-auto" style={{ maxHeight: 200 }}>
                  <div className="flex flex-wrap gap-0.5">{EMOJIS[emojiCat]?.map((em, i) => <button key={i} onClick={() => { setInput((p) => p + em); setShowEmoji(false); inputRef.current?.focus(); }} className="w-9 h-9 text-[20px] rounded-lg flex items-center justify-center transition-colors" onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>{em}</button>)}</div>
                </div>
              </div>
            )}

            {/* Quick Replies Panel */}
            {showQuickReplies && (
              <div className="mx-4 sm:mx-16 mb-1 rounded-2xl overflow-hidden animate-scale-in" style={{ background: "var(--md-surface-container-high)", boxShadow: "var(--md-elevation-3)", border: "1px solid var(--divider)", maxHeight: 360 }} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: "1px solid var(--divider)" }}>
                  <span className="text-[13px] font-semibold" style={{ color: "var(--md-on-surface)" }}>⚡ Quick Replies</span>
                  <div className="flex gap-1">
                    {qrMode === "list" && <button onClick={() => { setQrMode("add"); setQrTitle(""); setQrContent(""); setQrCategory(""); }} className="text-[11px] px-2.5 py-1 rounded-lg font-medium" style={{ background: "var(--md-primary)", color: "var(--md-on-primary)" }}>+ New</button>}
                    {qrMode !== "list" && <button onClick={() => { setQrMode("list"); setQrEditId(null); }} className="text-[11px] px-2 py-1" style={{ color: "var(--text-secondary)" }}>← Back</button>}
                    <button onClick={() => setShowQuickReplies(false)} className="text-lg leading-none" style={{ color: "var(--text-tertiary)" }}>✕</button>
                  </div>
                </div>
                {qrMode === "list" && (
                  <>
                    <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--divider)" }}>
                      <input type="text" value={qrSearch} onChange={(e) => setQrSearch(e.target.value)} placeholder="Search replies..." className="w-full rounded-lg px-3 py-1.5 text-[12px] focus:outline-none" style={{ background: "var(--md-surface-container)", color: "var(--md-on-surface)", border: "1px solid var(--divider)" }}/>
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                      {quickReplies.filter((qr) => !qrSearch || qr.title.toLowerCase().includes(qrSearch.toLowerCase()) || qr.content.toLowerCase().includes(qrSearch.toLowerCase())).length === 0 ? (
                        <div className="px-4 py-8 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>{quickReplies.length === 0 ? "No quick replies yet. Click + New to create one." : "No matches found."}</div>
                      ) : (
                        quickReplies.filter((qr) => !qrSearch || qr.title.toLowerCase().includes(qrSearch.toLowerCase()) || qr.content.toLowerCase().includes(qrSearch.toLowerCase())).map((qr) => (
                          <div key={qr.id} className="flex items-start gap-2 px-3 py-2.5 group cursor-pointer transition-colors" style={{ borderBottom: "1px solid var(--divider)" }} onClick={() => useQuickReply(qr)} onMouseEnter={(e) => e.currentTarget.style.background = "var(--sidebar-hover)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold" style={{ color: "var(--md-primary)" }}>{qr.title}</span>
                                {qr.category && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--md-surface-container)", color: "var(--text-tertiary)" }}>{qr.category}</span>}
                                <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>used {qr.usage_count}x</span>
                              </div>
                              <p className="text-[12px] truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>{qr.content}</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5">
                              <button onClick={(e) => { e.stopPropagation(); setQrMode("edit"); setQrEditId(qr.id); setQrTitle(qr.title); setQrContent(qr.content); setQrCategory(qr.category || ""); }} className="text-[10px] p-1" style={{ color: "var(--text-tertiary)" }}>✏️</button>
                              <button onClick={(e) => { e.stopPropagation(); deleteQuickReply(qr.id); }} className="text-[10px] p-1" style={{ color: "var(--md-error)" }}>🗑️</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
                {(qrMode === "add" || qrMode === "edit") && (
                  <div className="px-3 py-3 space-y-2.5">
                    <input type="text" value={qrTitle} onChange={(e) => setQrTitle(e.target.value)} placeholder="Title (e.g. Greeting, Price)" className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none" style={{ background: "var(--md-surface-container)", color: "var(--md-on-surface)", border: "1px solid var(--divider)" }}/>
                    <textarea value={qrContent} onChange={(e) => setQrContent(e.target.value)} placeholder={"Message content...\nUse {name} for customer name"} rows={3} className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none resize-none" style={{ background: "var(--md-surface-container)", color: "var(--md-on-surface)", border: "1px solid var(--divider)" }}/>
                    <input type="text" value={qrCategory} onChange={(e) => setQrCategory(e.target.value)} placeholder="Category (optional)" className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none" style={{ background: "var(--md-surface-container)", color: "var(--md-on-surface)", border: "1px solid var(--divider)" }}/>
                    <button onClick={qrMode === "edit" ? updateQuickReply : createQuickReply} disabled={!qrTitle.trim() || !qrContent.trim()} className="w-full py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-30 transition-colors" style={{ background: "var(--md-primary)", color: "var(--md-on-primary)" }}>
                      {qrMode === "edit" ? "Update" : "Save"} Quick Reply
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Input Area */}
            <div className="px-4 sm:px-12 py-3 flex items-end gap-2" style={{ background: "var(--md-surface-container-low)", borderTop: "1px solid var(--divider)" }}>
              <button onClick={(e) => { e.stopPropagation(); setShowEmoji(!showEmoji); setShowQuickReplies(false); }} className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}><span className="material-symbols-rounded" style={{ fontSize: 22 }}>mood</span></button>
              <button onClick={(e) => { e.stopPropagation(); setShowQuickReplies(!showQuickReplies); setShowEmoji(false); setQrMode("list"); setQrSearch(""); }} className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"} title="Quick Replies"><span className="material-symbols-rounded" style={{ fontSize: 22 }}>bolt</span></button>
              <button onClick={() => document.getElementById("file-input")?.click()} className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors" style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"} title="Attach file">
                <span className="material-symbols-rounded" style={{ fontSize: 22 }}>attach_file</span>
              </button>
              <input id="file-input" type="file" className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !selId) return;
                const icon = file.type.startsWith("image/") ? "📷" : file.type.startsWith("video/") ? "🎥" : "📄";
                const tempId = `temp_file_${Date.now()}`;
                addOptimisticMsg(tempId, `${icon} Sending ${file.name}...`, file.type.startsWith("image/") ? "image" : "document");
                setSending(true);
                try {
                  const fd = new FormData(); fd.append("file", file); fd.append("caption", "");
                  const res = await fetch(`/api/conversations/${selId}/send-media`, { method: "POST", body: fd });
                  if (!res.ok) { setMsgs((p) => p.filter((m) => m.id !== tempId)); const d = await res.json(); alert("Error: " + JSON.stringify(d)); setSending(false); }
                  else { const real = await res.json(); lastSentIdsRef.current.add(real.id); setMsgs((p) => p.map((m) => m.id === tempId ? { ...real } : m)); setTimeout(() => { setSending(false); setTimeout(() => lastSentIdsRef.current.delete(real.id), 10000); }, 3000); }
                } catch (err) { setMsgs((p) => p.filter((m) => m.id !== tempId)); alert("Error: " + String(err)); setSending(false); }
                finally { e.target.value = ""; }
              }}/>
              <div className="flex-1 rounded-2xl px-4 py-2.5 transition-colors" style={{ background: "var(--chat-input-bg)", border: "1px solid var(--divider)" }}>
                <textarea ref={inputRef} value={input} onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Type a message" rows={1} className="w-full bg-transparent text-[14px] focus:outline-none resize-none leading-[1.4] max-h-[120px] overflow-y-auto" style={{ color: "var(--md-on-surface)", height: "auto" }}/>
              </div>
              <button onClick={handleSend} disabled={sending || !input.trim()} className="w-10 h-10 rounded-xl disabled:opacity-20 transition-all flex items-center justify-center flex-shrink-0" style={{ background: "var(--md-primary)" }}>
                {sending ? <span className="material-symbols-rounded animate-spin" style={{ fontSize: 20, color: "var(--md-on-primary)" }}>progress_activity</span>
                : <span className="material-symbols-rounded" style={{ fontSize: 20, color: "var(--md-on-primary)", fontVariationSettings: "'FILL' 1" }}>send</span>}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Image Preview */}
      {imgPreview && <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "var(--overlay-bg)", backdropFilter: "blur(8px)" }} onClick={() => setImgPreview(null)}><button className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white text-xl" style={{ background: "rgba(255,255,255,0.1)" }}>✕</button><img src={imgPreview} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl" onClick={(e) => e.stopPropagation()}/></div>}

      {/* Forward Modal */}
      {forwardMsg && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "var(--overlay-bg)", backdropFilter: "blur(4px)" }} onClick={() => { setForwardMsg(null); setForwardSelected(new Set()); }}>
          <div className="rounded-2xl w-[380px] max-h-[520px] overflow-hidden animate-scale-in" style={{ background: "var(--md-surface-container-high)", boxShadow: "var(--md-elevation-3)", border: "1px solid var(--divider)" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--divider)" }}>
              <h3 className="text-[14px] font-semibold" style={{ color: "var(--md-on-surface)" }}>Forward to</h3>
              <button onClick={() => { setForwardMsg(null); setForwardSelected(new Set()); }} className="text-lg" style={{ color: "var(--text-tertiary)" }}>✕</button>
            </div>
            <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--divider)" }}>
              <div className="rounded-lg px-3 py-1.5 text-[12px] truncate" style={{ background: "var(--md-surface-container)", color: "var(--text-secondary)" }}>{forwardMsg.content?.substring(0, 100)}</div>
            </div>
            {forwardSelected.size > 0 && (
              <div className="px-3 py-2 flex items-center gap-2 flex-wrap" style={{ borderBottom: "1px solid var(--divider)" }}>
                {Array.from(forwardSelected).map((id) => { const c = convos.find((x) => x.id === id); return c ? (
                  <span key={id} className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "var(--md-primary-container)", color: "var(--md-on-primary-container)" }}>
                    {c.name || c.phone}
                    <button onClick={() => { const s = new Set(forwardSelected); s.delete(id); setForwardSelected(s); }}>✕</button>
                  </span>
                ) : null; })}
              </div>
            )}
            <div className="overflow-y-auto max-h-[320px]">
              {convos.filter((c) => c.id !== forwardMsg.conversation_id).map((c) => {
                const isSelected = forwardSelected.has(c.id);
                return (
                  <button key={c.id} onClick={() => { const s = new Set(forwardSelected); if (isSelected) s.delete(c.id); else s.add(c.id); setForwardSelected(s); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors" style={{ background: isSelected ? "var(--sidebar-selected)" : "transparent" }} onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--sidebar-hover)"; }} onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = isSelected ? "var(--sidebar-selected)" : "transparent"; }}>
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ background: isSelected ? "var(--md-primary)" : "transparent", borderColor: isSelected ? "var(--md-primary)" : "var(--md-outline)" }}>
                      {isSelected && <span className="material-symbols-rounded text-white" style={{ fontSize: 14 }}>check</span>}
                    </div>
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${aclr(c.id)} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0`}>{ini(c.name, c.phone)}</div>
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--md-on-surface)" }}>{c.name || c.phone}</p>
                  </button>
                );
              })}
            </div>
            {forwardSelected.size > 0 && (
              <div className="px-4 py-3 flex justify-end" style={{ borderTop: "1px solid var(--divider)" }}>
                <button onClick={() => forwardMessage(forwardMsg.id, Array.from(forwardSelected))} className="font-medium px-6 py-2.5 rounded-xl text-[13px] flex items-center gap-2 transition-colors" style={{ background: "var(--md-primary)", color: "var(--md-on-primary)" }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>send</span>
                  Send ({forwardSelected.size})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click-away overlay */}
      {(chatMenuId || msgMenuId || headerMenu || reactPickerId) && <div className="fixed inset-0 z-[90]" onClick={() => { setChatMenuId(null); setMsgMenuId(null); setHeaderMenu(false); setReactPickerId(null); setShowLabelMenu(null); setChatLabelOpen(null); setShowQuickReplies(false); }}/>}
    </div>
  );
}

// ═══ MENU ITEM COMPONENT ═══
function MI({ i, l, o, d }: { i: string; l: string; o: () => void; d?: boolean }) {
  return (
    <button onClick={o} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors" style={{ color: d ? "var(--md-error)" : "var(--md-on-surface)" }} onMouseEnter={(e) => e.currentTarget.style.background = d ? "rgba(186,26,26,0.08)" : "var(--ripple)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      <span className="material-symbols-rounded" style={{ fontSize: 18, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>{i}</span><span>{l}</span>
    </button>
  );
}
