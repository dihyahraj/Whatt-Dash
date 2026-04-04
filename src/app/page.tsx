"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { ConversationWithLastMessage, Message, MessageType, Label, QuickReply } from "@/lib/types";

/* ═══ CONSTANTS ═══ */
const EMOJIS: Record<string, string[]> = {
  "😀": ["😀","😃","😄","😁","😅","😂","🤣","😊","😇","🙂","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","👽","👾","🤖","🎃"],
  "👋": ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪"],
  "❤️": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","💕","💞","💓","💗","💖","💘","💝","💟","♥️"],
  "🎉": ["🎉","🎊","🎈","🎁","🎀","🏆","🥇","🔥","⭐","🌟","✨","💫","🌈","☀️","🌙","💡","🔔","📌","💰","💎","📱","💻","📷","🎵","🎶","🎤","🎧","🎸","🎬","📺","📚","📝","✏️","📎","✂️"],
  "🍔": ["🍏","🍎","🍊","🍋","🍌","🍉","🍇","🍓","🍒","🍑","🍍","🥥","🥝","🍅","🥑","🥦","🌽","🥕","🍞","🧀","🍳","🥓","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🌮","🌯","🥗","🍝","🍜","🍲","🍛","🍣","🍱","🍦","🎂","🍩","🍪","☕","🍵","🍺","🍷"],
  "🐶": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🦆","🦅","🦉","🐺","🐴","🦄","🐝","🦋","🐌","🐞","🐢","🐍","🐙","🐬","🐳","🦈","🐊","🐘","🦒"],
};
const QUICK_REACT = ["👍","❤️","😂","😮","😢","🙏","🔥","🎉"];
const LABEL_COLORS = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#f97316"];

/* ═══ STYLED HELPERS ═══ */
const s = {
  iconBtn: "w-9 h-9 rounded-xl flex items-center justify-center tr cursor-pointer",
  menuWrap: "rounded-2xl py-1 min-w-[200px] anim-scale-in overflow-hidden",
};

export default function Dashboard() {
  const { user, loading: authLoading, signOut, supabase } = useAuth();
  const router = useRouter();

  /* ═══ THEME ═══ */
  const [theme, setTheme] = useState<"light"|"dark"|"system">("dark");
  useEffect(() => {
    const saved = localStorage.getItem("wd-theme") as "light"|"dark"|"system"|null;
    const t = saved || "dark";
    setTheme(t);
    applyTheme(t);
  }, []);
  function applyTheme(t: "light"|"dark"|"system") {
    if (t === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    } else {
      document.documentElement.setAttribute("data-theme", t);
    }
  }
  function cycleTheme(pick: "light"|"dark"|"system") {
    setTheme(pick); localStorage.setItem("wd-theme", pick); applyTheme(pick); setSidebarMenu(false);
  }
  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const sbRT = useMemo(() => { const u = process.env.NEXT_PUBLIC_SUPABASE_URL, k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; if (!u || !k) return null; return createClient(u, k); }, []);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener("resize", check); return () => window.removeEventListener("resize", check); }, []);

  /* ═══ STATE ═══ */
  const [convos, setConvos] = useState<ConversationWithLastMessage[]>([]);
  const [selId, setSelId] = useState<string|null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSendingState] = useState(false);
  const setSending = (v: boolean) => { sendingRef.current = v; setSendingState(v); };
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [replyTo, setReplyTo] = useState<Message|null>(null);
  const [chatMenuId, setChatMenuId] = useState<string|null>(null);
  const [msgMenuId, setMsgMenuId] = useState<string|null>(null);
  const [reactPickerId, setReactPickerId] = useState<string|null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiClosing, setEmojiClosing] = useState(false);
  const [emojiCat, setEmojiCat] = useState("recent");
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [imgPreview, setImgPreview] = useState<string|null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [archived, setArchived] = useState<ConversationWithLastMessage[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter] = useState<"all"|"unread"|string>("all");
  const [labels, setLabels] = useState<Label[]>([]);
  const [showLabelMenu, setShowLabelMenu] = useState<string|null>(null);
  const [chatLabelOpen, setChatLabelOpen] = useState<string|null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#10b981");
  const [forwardMsg, setForwardMsg] = useState<Message|null>(null);
  const [forwardSelected, setForwardSelected] = useState<Set<string>>(new Set());
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [qrClosing, setQrClosing] = useState(false);
  const [qrMode, setQrMode] = useState<"list"|"add"|"edit">("list");
  const [qrTitle, setQrTitle] = useState("");
  const [qrContent, setQrContent] = useState("");
  const [qrCategory, setQrCategory] = useState("");
  const [qrEditId, setQrEditId] = useState<string|null>(null);
  const [qrSearch, setQrSearch] = useState("");
  const [slashActive, setSlashActive] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIdx, setSlashIdx] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [msgMenuPos, setMsgMenuPos] = useState<{x: number; y: number; isMe: boolean} | null>(null);
  const [sidebarMenu, setSidebarMenu] = useState(false);
  const [showLabelsModal, setShowLabelsModal] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [mfa2FAState, setMfa2FAState] = useState<"idle"|"enrolling"|"verifying"|"enabled">("idle");
  const [mfaQR, setMfaQR] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaVerifyCode, setMfaVerifyCode] = useState("");
  const [mfaError, setMfaError] = useState("");

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMsg, setHasNewMsg] = useState(false);
  const sendingRef = useRef(false);
  const lastSentIdsRef = useRef<Set<string>>(new Set());
  const skipPollRef = useRef(false);

  const sel = convos.find((c) => c.id === selId);

  /* ═══ FETCHERS (unchanged logic) ═══ */
  const fetchConvos = useCallback(async () => { if (skipPollRef.current) return; try { const r = await fetch("/api/conversations"); if (skipPollRef.current) return; const d = await r.json(); if (skipPollRef.current) return; if (Array.isArray(d)) setConvos(d); } catch {} }, []);
  const fetchMsgs = useCallback(async (id: string) => { if (sendingRef.current || skipPollRef.current) return; try { const r = await fetch(`/api/conversations/${id}/messages`); if (sendingRef.current || skipPollRef.current) return; const d = await r.json(); if (sendingRef.current || skipPollRef.current) return; if (Array.isArray(d)) setMsgs(d); } catch {} }, []);
  const fetchArchived = useCallback(async () => { if (skipPollRef.current) return; try { const r = await fetch("/api/conversations/archived"); if (skipPollRef.current) return; const d = await r.json(); if (skipPollRef.current) return; if (Array.isArray(d)) setArchived(d); } catch {} }, []);
  const fetchLabels = useCallback(async () => { try { const r = await fetch("/api/labels"); const d = await r.json(); if (Array.isArray(d)) setLabels(d); } catch {} }, []);
  const fetchQuickReplies = useCallback(async () => { try { const r = await fetch("/api/quick-replies"); const d = await r.json(); if (Array.isArray(d)) setQuickReplies(d); } catch {} }, []);

  async function createQuickReply() { if (!qrTitle.trim() || !qrContent.trim()) return; try { const r = await fetch("/api/quick-replies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: qrTitle, content: qrContent, category: qrCategory || null }) }); if (r.ok) { fetchQuickReplies(); setQrTitle(""); setQrContent(""); setQrCategory(""); setQrMode("list"); } } catch {} }
  async function updateQuickReply() { if (!qrEditId || !qrTitle.trim() || !qrContent.trim()) return; try { const r = await fetch(`/api/quick-replies/${qrEditId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: qrTitle, content: qrContent, category: qrCategory || null }) }); if (r.ok) { fetchQuickReplies(); setQrTitle(""); setQrContent(""); setQrCategory(""); setQrEditId(null); setQrMode("list"); } } catch {} }
  async function deleteQuickReply(id: string) { if (!confirm("Delete this quick reply?")) return; try { await fetch(`/api/quick-replies/${id}`, { method: "DELETE" }); fetchQuickReplies(); } catch {} }
  function useQuickReply(qr: QuickReply) { let t = qr.content; if (sel) { t = t.replace(/\{name\}/g, sel.name || sel.phone).replace(/\{phone\}/g, sel.phone); } setInput(t); closeQR(); setTimeout(() => smoothResizeInput(), 50); fetch(`/api/quick-replies/${qr.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ use: true }) }).catch(() => {}); }
  function selectSlashQR(qr: QuickReply) { let t = qr.content; if (sel) { t = t.replace(/\{name\}/g, sel.name || sel.phone).replace(/\{phone\}/g, sel.phone); } setInput(t); setSlashActive(false); setSlashQuery(""); setTimeout(() => smoothResizeInput(), 50); fetch(`/api/quick-replies/${qr.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ use: true }) }).catch(() => {}); }
  function smoothResizeInput() {
    const el = inputRef.current; if (!el) return;
    const from = el.offsetHeight;
    el.style.transition = "none"; el.style.height = "auto";
    const to = Math.min(el.scrollHeight, 120);
    el.style.height = from + "px"; el.offsetHeight; // force reflow
    el.style.transition = "height 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
    el.style.height = to + "px"; el.focus();
  }

  /* ═══ EFFECTS (unchanged logic) ═══ */
  useEffect(() => { fetchConvos(); fetchArchived(); fetchLabels(); fetchQuickReplies(); }, [fetchConvos, fetchArchived, fetchLabels, fetchQuickReplies]);
  // Load recent emojis from localStorage
  useEffect(() => { try { const r = JSON.parse(localStorage.getItem("wd-recent-emoji") || "[]"); if (Array.isArray(r)) setRecentEmojis(r.slice(0, 32)); } catch {} }, []);
  function addRecentEmoji(em: string) { const updated = [em, ...recentEmojis.filter(e => e !== em)].slice(0, 32); setRecentEmojis(updated); localStorage.setItem("wd-recent-emoji", JSON.stringify(updated)); }
  // Smooth close helpers
  function closeEmoji() { setEmojiClosing(true); setTimeout(() => { setShowEmoji(false); setEmojiClosing(false); }, 200); }
  function closeQR() { setQrClosing(true); setTimeout(() => { setShowQuickReplies(false); setQrClosing(false); }, 200); }
  useEffect(() => { if (selId) { fetchMsgs(selId); fetch(`/api/conversations/${selId}/read`, { method: "POST" }).catch(() => {}); setConvos(p => p.map(c => c.id === selId ? { ...c, unread_count: 0 } : c)); setIsAtBottom(true); } }, [selId, fetchMsgs]);
  useEffect(() => { if (isAtBottom) { endRef.current?.scrollIntoView({ behavior: "smooth" }); setHasNewMsg(false); } else if (msgs.length > 0) { setHasNewMsg(true); } }, [msgs, isAtBottom]);

  function handleScroll() { const el = chatBoxRef.current; if (!el) return; const ab = el.scrollHeight - el.scrollTop - el.clientHeight < 80; setIsAtBottom(ab); if (ab) setHasNewMsg(false); }
  function scrollToBottom() { endRef.current?.scrollIntoView({ behavior: "smooth" }); setIsAtBottom(true); setHasNewMsg(false); }

  useEffect(() => { const iv = setInterval(() => { if (skipPollRef.current || sendingRef.current) return; fetchConvos(); if (selId) { fetchMsgs(selId); fetch(`/api/conversations/${selId}/read`, { method: "POST" }).catch(() => {}); setConvos(p => p.map(c => c.id === selId ? { ...c, unread_count: 0 } : c)); } }, 2000); return () => clearInterval(iv); }, [fetchConvos, fetchMsgs, selId]);

  function notifyNewMsg(msg: Message) { const c = convos.find(x => x.id === msg.conversation_id); if (c?.is_muted) return; const title = c?.name || c?.phone || "New Message"; const body = msg.content?.substring(0, 100) || "New message"; if ("Notification" in window && Notification.permission === "granted") { new Notification(title, { body, icon: "/favicon.ico", tag: msg.conversation_id }); } try { const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 800; g.gain.value = 0.3; o.start(); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3); o.stop(ctx.currentTime + 0.3); } catch {} }

  useEffect(() => {
    if (!sbRT) return;
    const ch = sbRT.channel("rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => { const m = p.new as Message; if (m.conversation_id === selId) { setMsgs(prev => { if (prev.some(x => x.id === m.id)) return prev; if (lastSentIdsRef.current.has(m.id)) return prev; const ti = prev.findIndex(x => x.id.startsWith("temp_") && x.content === m.content && x.role === m.role); if (ti >= 0) { const u = [...prev]; u[ti] = m; return u; } if (m.role === "assistant" && sendingRef.current) return prev; return [...prev, m]; }); if (m.role === "user") fetch(`/api/conversations/${selId}/read`, { method: "POST" }).catch(() => {}); } if (m.role === "user") notifyNewMsg(m); fetchConvos(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (p) => { const u = p.new as Message; setMsgs(prev => prev.map(m => m.id === u.id ? u : m)); })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => fetchConvos())
      .subscribe();
    return () => { sbRT.removeChannel(ch); };
  }, [selId, fetchConvos, sbRT]);

  useEffect(() => { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); }, []);

  // PWA back button — go to sidebar instead of exiting app
  useEffect(() => {
    if (selId) { window.history.pushState({ chat: selId }, ""); }
    const onBack = (e: PopStateEvent) => {
      if (selId) { e.preventDefault(); setSelId(null); setMsgs([]); setSidebarOpen(true); }
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [selId]);
  useEffect(() => { const t = convos.reduce((s, c) => s + (c.unread_count || 0), 0); document.title = t > 0 ? `(${t}) Whatt Dash` : "Whatt Dash"; }, [convos]);

  /* ═══ SEND ═══ */
  async function handleSend() {
    if (!input.trim() || !selId || sending) return;
    const text = input.trim(); const reply = replyTo;
    const tempId = `temp_${Date.now()}`;
    const om: Message = { id: tempId, conversation_id: selId, role: "assistant", content: text, message_type: "text", media_url: null, media_mime_type: null, media_filename: null, media_caption: null, media_sha256: null, reply_to_id: reply?.id || null, reaction: null, reaction_msg_id: null, latitude: null, longitude: null, location_name: null, location_address: null, whatsapp_msg_id: null, is_deleted: false, is_starred: false, status: "sent", created_at: new Date().toISOString() };
    setMsgs(p => [...p, om]); setInput(""); setReplyTo(null); setTimeout(() => smoothResizeInput(), 20); setIsAtBottom(true); setSending(true);
    try { const b: Record<string, string> = { message: text }; if (reply) { b.replyToMsgId = reply.id; if (reply.whatsapp_msg_id) b.replyToWhatsappId = reply.whatsapp_msg_id; } const r = await fetch(`/api/conversations/${selId}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }); if (!r.ok) { setMsgs(p => p.filter(m => m.id !== tempId)); const d = await r.json(); alert("Error:\n" + JSON.stringify(d, null, 2)); setInput(text); return; } const real = await r.json(); lastSentIdsRef.current.add(real.id); setMsgs(p => p.map(m => m.id === tempId ? { ...real } : m)); setTimeout(() => { setSending(false); setTimeout(() => lastSentIdsRef.current.delete(real.id), 10000); }, 3000); } catch (e) { setMsgs(p => p.filter(m => m.id !== tempId)); setInput(text); alert("Network Error: " + String(e)); setSending(false); }
  }

  /* ═══ ACTIONS ═══ */
  function closeMenus() { setChatMenuId(null); setHeaderMenu(false); setMsgMenuId(null); setMsgMenuPos(null); setSidebarMenu(false); }
  function pausePoll(ms = 4000) { skipPollRef.current = true; setTimeout(() => { skipPollRef.current = false; }, ms); }

  async function act(url: string, body?: object) { closeMenus(); pausePoll(); if (body && typeof body === "object") { const b = body as Record<string, unknown>; const cid = url.match(/conversations\/([^/]+)\//)?.[1]; if ("archived" in b && b.archived) { const chat = convos.find(c => c.id === cid); setConvos(p => p.filter(c => c.id !== cid)); if (chat) setArchived(p => [{ ...chat, is_archived: true }, ...p]); if (selId === cid) { setSelId(null); setMsgs([]); } } else { setConvos(p => p.map(c => { if (c.id !== cid) return c; if ("pinned" in b) return { ...c, is_pinned: !!b.pinned }; if ("muted" in b) return { ...c, is_muted: !!b.muted }; if ("unread_count" in b) return { ...c, unread_count: b.unread_count as number }; return c; })); } } fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).catch(() => {}); }
  async function delChat(id: string) { if (!confirm("Delete this chat?")) return; closeMenus(); pausePoll(); setConvos(p => p.filter(c => c.id !== id)); setArchived(p => p.filter(c => c.id !== id)); if (selId === id) { setSelId(null); setMsgs([]); } fetch(`/api/conversations/${id}/delete`, { method: "POST" }).catch(() => {}); }
  async function unarchive(id: string) { pausePoll(); const c = archived.find(x => x.id === id); setArchived(p => p.filter(x => x.id !== id)); if (c) setConvos(p => [{ ...c, is_archived: false }, ...p]); fetch(`/api/conversations/${id}/archive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: false }) }).catch(() => {}); }
  async function starMsg(id: string, v: boolean) { pausePoll(); setMsgs(p => p.map(m => m.id === id ? { ...m, is_starred: v } : m)); setMsgMenuId(null); fetch(`/api/messages/${id}/star`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starred: v }) }).catch(() => {}); }
  async function reactMsg(msgId: string, emoji: string) { if (!selId) return; pausePoll(); const m = msgs.find(x => x.id === msgId); const ne = m?.reaction === emoji ? "" : emoji; setMsgs(p => p.map(x => x.id === msgId ? { ...x, reaction: ne || null } : x)); setReactPickerId(null); fetch(`/api/conversations/${selId}/react`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: msgId, emoji: ne, whatsappMsgId: m?.whatsapp_msg_id || null }) }).catch(() => {}); }
  async function createLabel() { if (!newLabelName.trim()) return; pausePoll(); const tl = { id: `temp_${Date.now()}`, name: newLabelName.trim(), color: newLabelColor, created_by_email: user?.email, created_by_name: user?.display_name, created_by_role: user?.role }; setLabels(p => [...p, tl]); setNewLabelName(""); fetch("/api/labels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: tl.name, color: tl.color, created_by_email: user?.email, created_by_name: user?.display_name, created_by_role: user?.role }) }).then(() => fetchLabels()).catch(() => {}); }
  async function deleteLabel(id: string) { if (!confirm("Delete this label?")) return; pausePoll(); setLabels(p => p.filter(l => l.id !== id)); fetch(`/api/labels/${id}?email=${encodeURIComponent(user?.email || "")}&role=${encodeURIComponent(user?.role || "user")}`, { method: "DELETE" }).then(r => { if (!r.ok) r.json().then(d => alert(d.error || "Cannot delete")); fetchLabels(); fetchConvos(); }).catch(() => {}); }
  async function toggleLabel(convoId: string, labelId: string, has: boolean) { pausePoll(); const lb = labels.find(l => l.id === labelId); if (lb) { setConvos(p => p.map(c => { if (c.id !== convoId) return c; return { ...c, labels: has ? c.labels.filter(l => l.id !== labelId) : [...c.labels, lb] }; })); } setShowLabelMenu(null); fetch(`/api/conversations/${convoId}/labels`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label_id: labelId, action: has ? "remove" : "add" }) }).catch(() => {}); }
  async function forwardMessage(msgId: string, targetIds: string[]) { if (!targetIds.length) return; await fetch(`/api/messages/${msgId}/forward`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetConversationIds: targetIds }) }); setForwardMsg(null); setForwardSelected(new Set()); fetchConvos(); }
  function saveContact(cid: string) { window.open(`/api/conversations/${cid}/save-contact`, "_blank"); }
  function downloadContactsCsv() { window.open("/api/contacts/export", "_blank"); }
  function addOptimisticMsg(tid: string, content: string, type: string = "text") { if (!selId) return; const m: Message = { id: tid, conversation_id: selId, role: "assistant", content, message_type: type as Message["message_type"], media_url: null, media_mime_type: null, media_filename: null, media_caption: null, media_sha256: null, reply_to_id: null, reaction: null, reaction_msg_id: null, latitude: null, longitude: null, location_name: null, location_address: null, whatsapp_msg_id: null, is_deleted: false, is_starred: false, status: "sent", created_at: new Date().toISOString() }; setMsgs(p => [...p, m]); setIsAtBottom(true); }

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setReplyTo(null); setChatMenuId(null); setMsgMenuId(null); setMsgMenuPos(null); setReactPickerId(null); setShowEmoji(false); setHeaderMenu(false); setImgPreview(null); setShowChatSearch(false); setChatLabelOpen(null); setShowLabelMenu(null); setForwardMsg(null); setForwardSelected(new Set()); setSidebarMenu(false); setShowLabelsModal(false); setShow2FA(false); setSlashActive(false); } }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, []);

  /* ═══ HELPERS ═══ */
  function ft(d: string) { const t = new Date(d), n = new Date(), df = n.getTime() - t.getTime(); if (df < 86400000 && t.getDate() === n.getDate()) return t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); if (df < 172800000) return "Yesterday"; if (df < 604800000) return t.toLocaleDateString([], { weekday: "short" }); return t.toLocaleDateString([], { month: "short", day: "numeric" }); }
  function mt(d: string) { return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  function ini(n: string|null, p: string) { if (n) { const sp = n.trim().split(/\s+/); return sp.length >= 2 ? (sp[0][0] + sp[1][0]).toUpperCase() : n.slice(0, 2).toUpperCase(); } return p.slice(-2); }
  const AVATAR_COLORS = ["from-emerald-400 to-teal-600","from-blue-400 to-indigo-600","from-purple-400 to-violet-600","from-orange-400 to-red-600","from-pink-400 to-rose-600","from-cyan-400 to-blue-600","from-amber-400 to-orange-600","from-lime-400 to-green-600"];
  function aclr(id: string) { let h = 0; for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; }
  function lmp(c: ConversationWithLastMessage) { const p = c.last_message_role === "assistant" ? "✓ " : ""; const ic: Partial<Record<MessageType, string>> = { image: "📷 Photo", video: "🎥 Video", audio: "🎵 Audio", document: "📄 Document", sticker: "🏷️ Sticker", location: "📍 Location", contacts: "📇 Contact" }; if (c.last_message_type && c.last_message_type !== "text" && ic[c.last_message_type]) return p + ic[c.last_message_type]; return p + (c.last_message || ""); }
  function si(st: string) { if (st === "sent") return <span className="material-symbols-rounded inline ml-0.5" style={{ fontSize: 14, color: "var(--bubble-me-meta)" }}>check</span>; if (st === "delivered") return <span className="material-symbols-rounded inline ml-0.5" style={{ fontSize: 14, color: "var(--bubble-me-meta)" }}>done_all</span>; if (st === "read") return <span className="material-symbols-rounded inline ml-0.5" style={{ fontSize: 14, color: "#53bdeb" }}>done_all</span>; return null; }
  function dl(d: string) { const t = new Date(d), n = new Date(); if (t.toDateString() === n.toDateString()) return "Today"; const y = new Date(n); y.setDate(y.getDate()-1); if (t.toDateString() === y.toDateString()) return "Yesterday"; return t.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }
  function sd(m: Message[], i: number) { return i === 0 || new Date(m[i].created_at).toDateString() !== new Date(m[i-1].created_at).toDateString(); }

  const filtered = convos.filter(c => { if (search) { const q = search.toLowerCase(); if (!(c.name?.toLowerCase().includes(q) || c.phone.includes(q) || c.last_message?.toLowerCase().includes(q))) return false; } if (filter === "unread") return c.unread_count > 0; if (filter !== "all") return c.labels?.some((l: Label) => l.id === filter); return true; });
  const displayMsgs = chatSearch ? msgs.filter(m => m.content?.toLowerCase().includes(chatSearch.toLowerCase())) : msgs;

  /* ═══ MEDIA ═══ */
  function media(msg: Message) {
    if (msg.is_deleted) return <p className="italic text-[13px]" style={{ color: "var(--text-4)" }}>🚫 This message was deleted</p>;
    switch (msg.message_type) {
      case "image": return <div>{msg.media_url && <img src={msg.media_url} alt="" className="rounded-xl max-w-[260px] max-h-[300px] object-cover cursor-pointer hover:brightness-[0.92] tr" onClick={() => setImgPreview(msg.media_url)}/>}{msg.media_caption && msg.media_caption !== "[image]" && <p className="text-[13px] mt-1.5 whitespace-pre-wrap select-text">{msg.media_caption}</p>}</div>;
      case "video": return <div>{msg.media_url ? <video controls className="rounded-xl max-w-[260px]" preload="metadata"><source src={msg.media_url} type={msg.media_mime_type || "video/mp4"}/></video> : <span className="text-[13px]">🎥 Video</span>}{msg.media_caption && <p className="text-[13px] mt-1.5 select-text">{msg.media_caption}</p>}</div>;
      case "audio": return msg.media_url ? <audio controls className="max-w-[240px]" preload="metadata"><source src={msg.media_url} type={msg.media_mime_type || "audio/ogg"}/></audio> : <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-3)" }}><div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "var(--primary)" }}/><span>Sending voice...</span></div>;
      case "document": return <a href={msg.media_url || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl p-3 min-w-[200px] tr" style={{ background: "var(--primary-muted)" }}><div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--primary-muted)" }}><span className="material-symbols-rounded" style={{ fontSize: 20, color: "var(--primary)" }}>description</span></div><div className="flex-1 min-w-0"><p className="text-[13px] font-semibold truncate">{msg.media_filename || "Document"}</p><p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{msg.media_mime_type || "File"}</p></div><span className="material-symbols-rounded" style={{ fontSize: 16, color: "var(--text-4)" }}>open_in_new</span></a>;
      case "sticker": return msg.media_url ? <img src={msg.media_url} alt="" className="w-[120px] h-[120px] object-contain"/> : <span className="text-4xl">🏷️</span>;
      case "location": return <a href={`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`} target="_blank" rel="noreferrer" className="block rounded-xl p-3 min-w-[180px] tr" style={{ background: "var(--primary-muted)" }}><p className="text-[13px] font-semibold">📍 {msg.location_name || "Location"}</p>{msg.location_address && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{msg.location_address}</p>}<p className="text-[11px] mt-1 font-medium" style={{ color: "var(--primary)" }}>Open in Maps →</p></a>;
      default: return <p className="text-[13.5px] whitespace-pre-wrap break-words leading-[1.55] select-text">{msg.content}</p>;
    }
  }

  /* ═══ LABEL SUBMENU ═══ */
  function LabelSub({ convo }: { convo: ConversationWithLastMessage }) {
    return <div className="px-2 py-1.5" style={{ borderTop: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
      {labels.map(l => { const has = convo.labels?.some((cl: Label) => cl.id === l.id); return <button key={l.id} onClick={e => { e.stopPropagation(); toggleLabel(convo.id, l.id, !!has); }} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] tr hover:bg-[var(--primary-muted)]"><span className="w-3.5 h-3.5 rounded-full flex-shrink-0 tr" style={{ background: has ? l.color : "transparent", border: `2px solid ${l.color}`, boxShadow: has ? `0 0 0 2px ${l.color}33` : "none" }}/><span style={{ color: has ? "var(--text-1)" : "var(--text-3)" }}>{l.name}</span></button>; })}
      {labels.length === 0 && <p className="text-[11px] px-2 py-2" style={{ color: "var(--text-4)" }}>No labels yet</p>}
    </div>;
  }

  /* ═══ CONTEXT MENU ═══ */
  function ChatCtx({ convo, onClose }: { convo: ConversationWithLastMessage; onClose: () => void }) {
    const lo = chatLabelOpen === convo.id;
    return <div className={s.menuWrap} style={{ background: "var(--surface-2)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)", backdropFilter: "blur(16px)", position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 100 }} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
      <MI i="push_pin" l={convo.is_pinned ? "Unpin" : "Pin"} o={() => { act(`/api/conversations/${convo.id}/pin`, { pinned: !convo.is_pinned }); onClose(); }}/>
      <MI i={convo.is_muted ? "notifications_active" : "notifications_off"} l={convo.is_muted ? "Unmute" : "Mute"} o={() => { act(`/api/conversations/${convo.id}/mute`, { muted: !convo.is_muted }); onClose(); }}/>
      <MI i="mark_email_unread" l="Mark unread" o={() => { act(`/api/conversations/${convo.id}/unread`, { unread_count: 1 }); onClose(); }}/>
      <MI i="contact_page" l="Save contact" o={() => { saveContact(convo.id); onClose(); }}/>
      <button onClick={e => { e.preventDefault(); e.stopPropagation(); setChatLabelOpen(lo ? null : convo.id); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] tr hover:bg-[var(--primary-muted)]" style={{ color: "var(--text-1)" }}><span className="material-symbols-rounded" style={{ fontSize: 18 }}>label</span><span className="flex-1 text-left">Labels</span><span className={`material-symbols-rounded tr ${lo ? "rotate-180" : ""}`} style={{ fontSize: 14 }}>expand_more</span></button>
      {lo && <LabelSub convo={convo}/>}
      <MI i="archive" l="Archive" o={() => { act(`/api/conversations/${convo.id}/archive`, { archived: true }); onClose(); }}/>
      {user?.role === "admin" && <><div style={{ height: 1, background: "var(--border)", margin: "2px 0" }}/><MI i="delete" l="Delete" o={() => { delChat(convo.id); onClose(); }} d/></>}
    </div>;
  }

  /* ═══ 2FA FUNCTIONS ═══ */
  async function open2FAModal() {
    setShow2FA(true); setMfaError(""); setMfaVerifyCode("");
    if (!supabase) return;
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find(f => f.status === "verified");
      if (verified) { setMfa2FAState("enabled"); setMfaFactorId(verified.id); return; }
      // Remove any non-verified factors (leftover from incomplete setup)
      const leftover = factors?.totp?.filter(f => f.status !== "verified") || [];
      for (const f of leftover) { await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {}); }
      setMfa2FAState("idle");
    } catch { setMfa2FAState("idle"); }
  }

  async function enroll2FA() {
    if (!supabase) return;
    setMfaError(""); setMfa2FAState("enrolling");
    try {
      // Try to clean up old factors first
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const allTotp = factors?.totp || [];
        for (const f of allTotp) {
          if (f.status !== "verified") {
            await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
          }
        }
      } catch {}
      // Enroll with unique name to avoid conflict
      const name = `Whatt Dash ${Date.now()}`;
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: name });
      if (error || !data) { setMfaError(error?.message || "Failed to enroll"); setMfa2FAState("idle"); return; }
      setMfaQR(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
      setMfaFactorId(data.id);
      setMfa2FAState("verifying");
    } catch (e) { setMfaError(String(e)); setMfa2FAState("idle"); }
  }

  async function verify2FAEnrollment() {
    if (!supabase || !mfaVerifyCode || mfaVerifyCode.length !== 6) { setMfaError("Enter 6-digit code"); return; }
    setMfaError("");
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (cErr || !challenge) { setMfaError("Challenge failed"); return; }
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code: mfaVerifyCode });
      if (vErr) { setMfaError("Invalid code. Try again."); setMfaVerifyCode(""); return; }
      setMfa2FAState("enabled");
      setMfaVerifyCode("");
    } catch (e) { setMfaError(String(e)); }
  }

  async function disable2FA() {
    if (!supabase || !confirm("Disable Two-Factor Authentication?")) return;
    setMfaError("");
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      if (error) { setMfaError(error.message); return; }
      setMfa2FAState("idle"); setMfaFactorId(""); setMfaQR(""); setMfaSecret("");
    } catch (e) { setMfaError(String(e)); }
  }

  /* ═══ AUTH LOADING ═══ */
  if (authLoading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}><div className="flex flex-col items-center gap-4"><div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--primary)" }}><span className="material-symbols-rounded text-white" style={{ fontSize: 28, fontVariationSettings: "'FILL' 1" }}>chat</span></div><div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}/></div></div>;
  if (!user) { window.location.href = "/login"; return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}><p className="text-sm" style={{ color: "var(--text-4)" }}>Redirecting...</p></div>; }

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex overflow-hidden select-none" style={{ background: "var(--bg)", height: "100dvh", touchAction: "manipulation" }}>

      {/* ▓▓▓▓ SIDEBAR ▓▓▓▓ */}
      <div className={`${selId && !sidebarOpen ? "hidden md:flex" : "flex"} w-full md:w-[380px] flex-col flex-shrink-0 tr`} style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)" }}>

        {/* ── Header ── */}
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-[14px] flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-soft))" }}>
                <span className="material-symbols-rounded text-white" style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}>chat</span>
              </div>
              <div>
                <h1 className="text-[16px] font-extrabold tracking-tight" style={{ color: "var(--text-1)" }}>Whatt Dash</h1>
                <p className="text-[11px] font-medium" style={{ color: "var(--text-4)" }}>{user.display_name} · {convos.length} chats</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={() => setShowSearch(!showSearch)} className={s.iconBtn} style={{ color: "var(--text-3)" }}><span className="material-symbols-rounded" style={{ fontSize: 20 }}>search</span></button>
              <div className="relative">
                <button onClick={e => { e.stopPropagation(); setSidebarMenu(!sidebarMenu); }} className={s.iconBtn} style={{ color: "var(--text-3)" }}><span className="material-symbols-rounded" style={{ fontSize: 20 }}>more_vert</span></button>
                {sidebarMenu && <div className={s.menuWrap} style={{ background: "var(--surface-2)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)", backdropFilter: "blur(20px)", position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 100, minWidth: 220 }} onClick={e => e.stopPropagation()}>
                  {/* Theme Section */}
                  <div className="px-4 pt-2.5 pb-1"><p className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--text-4)" }}>Theme</p></div>
                  <div className="px-3 pb-1.5 flex gap-1">
                    {([["light", "light_mode", "Light"], ["dark", "dark_mode", "Dark"], ["system", "desktop_windows", "System"]] as const).map(([val, icon, label]) => (
                      <button key={val} onClick={() => cycleTheme(val)} className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl tr" style={{ background: theme === val ? "var(--primary-muted)" : "transparent", color: theme === val ? "var(--primary)" : "var(--text-3)" }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 18, fontVariationSettings: theme === val ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
                        <span className="text-[10px] font-semibold">{label}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }}/>
                  <MI i="security" l="Two-Factor Auth" o={() => { setSidebarMenu(false); open2FAModal(); }}/>
                  <MI i="label" l="Manage Labels" o={() => { setSidebarMenu(false); setShowLabelsModal(true); }}/>
                  {user.role === "admin" && <MI i="group" l="Manage Users" o={() => { router.push("/admin"); setSidebarMenu(false); }}/>}
                  {user.role === "admin" && <MI i="download" l="Export Contacts" o={() => { downloadContactsCsv(); setSidebarMenu(false); }}/>}
                  {user.role === "admin" && <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }}/>}
                  <MI i="logout" l="Sign Out" o={() => { setSidebarMenu(false); signOut(); }} d/>
                </div>}
              </div>
            </div>
          </div>
          {showSearch && <div className="relative mt-3 anim-fade-up"><span className="material-symbols-rounded absolute left-3.5 top-1/2 -translate-y-1/2" style={{ fontSize: 18, color: "var(--text-4)" }}>search</span><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..." className="w-full rounded-xl pl-10 pr-4 py-2.5 text-[13px] focus:outline-none tr" style={{ background: "var(--surface-3)", color: "var(--text-1)", border: "1.5px solid transparent" }} onFocus={e => e.target.style.borderColor = "var(--border-focus)"} onBlur={e => e.target.style.borderColor = "transparent"} autoFocus/></div>}
        </div>

        {/* ── Filter Chips ── */}
        <div className="px-3 py-2.5 flex gap-2 overflow-x-auto items-start" style={{ borderBottom: "1px solid var(--border)" }}>
          {[{ id: "all", label: "All" }, { id: "unread", label: "Unread" }].map(f => <button key={f.id} onClick={() => setFilter(f.id)} className="px-3.5 py-[6px] rounded-full text-[12px] font-semibold flex-shrink-0 tr" style={{ background: filter === f.id ? "var(--primary)" : "var(--surface-3)", color: filter === f.id ? "var(--primary-text)" : "var(--text-3)", boxShadow: filter === f.id ? "var(--shadow-sm)" : "none" }}>{f.label}</button>)}
          {labels.map(l => <button key={l.id} onClick={() => setFilter(filter === l.id ? "all" : l.id)} className="px-3.5 py-[5px] rounded-xl text-[12px] font-semibold flex-shrink-0 tr flex flex-col items-center gap-0" style={{ background: filter === l.id ? l.color : "var(--surface-3)", color: filter === l.id ? "#fff" : "var(--text-3)", minWidth: 60 }}>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: filter === l.id ? "#fff" : l.color }}/><span>{l.name}</span></div>
            <span className="text-[9px] font-medium" style={{ opacity: 0.6 }}>{l.created_by_role === "admin" ? "Admin" : (l.created_by_name || "")}</span>
          </button>)}
        </div>

        {/* ── Conversation List ── */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <div className="flex flex-col items-center justify-center h-48 gap-2"><span className="material-symbols-rounded" style={{ fontSize: 32, color: "var(--text-4)" }}>forum</span><p className="text-[13px]" style={{ color: "var(--text-4)" }}>{search ? "No results" : "No conversations"}</p></div>}
          {filtered.map(c => {
            const isSel = selId === c.id;
            return <div key={c.id} className="relative tr group" style={{ background: isSel ? "var(--primary-muted)" : "transparent" }} onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "var(--surface-3)"; }} onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
              <div className="flex items-center px-3 py-3 cursor-pointer gap-3" onClick={() => { setSelId(c.id); setChatMenuId(null); setSidebarOpen(false); }}>
                <div className={`w-[48px] h-[48px] rounded-[16px] bg-gradient-to-br ${aclr(c.id)} flex items-center justify-center flex-shrink-0 text-white text-[14px] font-bold shadow-sm`}>{ini(c.name, c.phone)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] truncate" style={{ fontWeight: c.unread_count > 0 ? 700 : 500, color: "var(--text-1)" }}>{c.name || c.phone}</span>
                    <span className="text-[11px] flex-shrink-0 ml-2 font-medium" style={{ color: c.unread_count > 0 ? "var(--primary)" : "var(--text-4)" }}>{ft(c.last_message_time || c.updated_at)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[12.5px] truncate flex-1 min-w-0" style={{ color: c.unread_count > 0 ? "var(--text-2)" : "var(--text-3)" }}>{lmp(c)}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      {c.labels?.map((l: Label) => <span key={l.id} className="w-[7px] h-[7px] rounded-full" style={{ background: l.color }}/>)}
                      {c.is_pinned && <span className="material-symbols-rounded" style={{ fontSize: 14, color: "var(--text-4)", fontVariationSettings: "'FILL' 1" }}>push_pin</span>}
                      {c.is_muted && <span className="material-symbols-rounded" style={{ fontSize: 14, color: "var(--text-4)" }}>notifications_off</span>}
                      {c.unread_count > 0 && <span className="min-w-[20px] h-[20px] rounded-full text-[10px] font-bold flex items-center justify-center px-1.5" style={{ background: "var(--unread-badge)", color: "var(--unread-badge-text)" }}>{c.unread_count}</span>}
                    </div>
                  </div>
                </div>
                <div className="relative flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); setChatMenuId(chatMenuId === c.id ? null : c.id); }} className="w-8 h-8 rounded-lg flex items-center justify-center tr opacity-40 hover:opacity-100 group-hover:opacity-80" style={{ color: "var(--text-3)" }}><span className="material-symbols-rounded" style={{ fontSize: 18 }}>more_vert</span></button>
                  {chatMenuId === c.id && <ChatCtx convo={c} onClose={() => setChatMenuId(null)}/>}
                </div>
              </div>
            </div>;
          })}

          {/* Archived */}
          {archived.length > 0 && <div style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={async () => { setShowArchived(!showArchived); if (!showArchived) try { const r = await fetch("/api/conversations/archived"); const d = await r.json(); if (Array.isArray(d)) setArchived(d); } catch {} }} className="w-full flex items-center gap-3 px-4 py-3 tr hover:bg-[var(--surface-3)]" style={{ color: "var(--text-3)" }}><span className="material-symbols-rounded" style={{ fontSize: 20 }}>archive</span><span className="text-[13px] font-semibold">Archived ({archived.length})</span><span className={`material-symbols-rounded tr ${showArchived ? "rotate-180" : ""}`} style={{ fontSize: 14, marginLeft: "auto" }}>expand_more</span></button>
            {showArchived && archived.map(ac => <div key={ac.id} className="flex items-center px-3 py-2.5 tr hover:bg-[var(--surface-3)]">
              <div className={`w-10 h-10 rounded-[14px] bg-gradient-to-br ${aclr(ac.id)} flex items-center justify-center flex-shrink-0 text-white text-[12px] font-bold opacity-50`}>{ini(ac.name, ac.phone)}</div>
              <div className="flex-1 min-w-0 ml-3 cursor-pointer" onClick={() => { setSelId(ac.id); setSidebarOpen(false); }}><span className="text-[13px] truncate block" style={{ color: "var(--text-3)" }}>{ac.name || ac.phone}</span><p className="text-[11px] truncate" style={{ color: "var(--text-4)" }}>{lmp(ac)}</p></div>
              <div className="flex gap-1.5 ml-2 flex-shrink-0">
                <button onClick={() => unarchive(ac.id)} className="px-2.5 py-1 text-[11px] rounded-lg font-semibold tr" style={{ background: "var(--primary-muted)", color: "var(--primary)" }}>Unarchive</button>
                {user.role === "admin" && <button onClick={() => delChat(ac.id)} className="px-2.5 py-1 text-[11px] rounded-lg font-semibold tr" style={{ background: "var(--danger-muted)", color: "var(--danger)" }}>Delete</button>}
              </div>
            </div>)}
          </div>}
        </div>
      </div>

      {/* ▓▓▓▓ CHAT AREA ▓▓▓▓ */}
      <div className={`flex-1 flex flex-col min-w-0 ${selId && !sidebarOpen ? "flex" : "hidden md:flex"}`}>
        {!sel ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6" style={{ background: "var(--bg)" }}>
            <div className="w-28 h-28 rounded-[28px] flex items-center justify-center" style={{ background: "var(--surface-3)" }}><span className="material-symbols-rounded" style={{ fontSize: 48, color: "var(--text-4)", fontVariationSettings: "'FILL' 1" }}>forum</span></div>
            <div className="text-center"><p className="text-[18px] font-bold mb-1" style={{ color: "var(--text-2)" }}>Whatt Dash</p><p className="text-[13px]" style={{ color: "var(--text-4)" }}>Select a chat to start messaging</p></div>
          </div>
        ) : (<>
          {/* ── Chat Header ── */}
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--bg-raised)", borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3">
              <button onClick={() => { setSelId(null); setSidebarOpen(true); if (window.history.state?.chat) window.history.back(); }} className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center -ml-1" style={{ color: "var(--text-1)" }}><span className="material-symbols-rounded" style={{ fontSize: 24 }}>arrow_back</span></button>
              <div className={`w-10 h-10 rounded-[14px] bg-gradient-to-br ${aclr(sel.id)} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>{ini(sel.name, sel.phone)}</div>
              <div><h2 className="text-[15px] font-bold tracking-tight" style={{ color: "var(--text-1)" }}>{sel.name || sel.phone}</h2><p className="text-[11px] font-mono" style={{ color: "var(--text-4)" }}>{sel.phone}</p></div>
            </div>
            <div className="flex items-center">
              <button onClick={() => { setShowChatSearch(!showChatSearch); setChatSearch(""); }} className={s.iconBtn} style={{ color: "var(--text-3)" }}><span className="material-symbols-rounded" style={{ fontSize: 20 }}>search</span></button>
              <div className="relative">
                <button onClick={e => { e.stopPropagation(); setHeaderMenu(!headerMenu); setChatMenuId(null); setMsgMenuId(null); }} className={s.iconBtn} style={{ color: "var(--text-3)" }}><span className="material-symbols-rounded" style={{ fontSize: 20 }}>more_vert</span></button>
                {headerMenu && <div className={s.menuWrap} style={{ background: "var(--surface-2)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)", backdropFilter: "blur(16px)", position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 100 }} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                  <MI i="push_pin" l={sel.is_pinned ? "Unpin" : "Pin"} o={() => act(`/api/conversations/${sel.id}/pin`, { pinned: !sel.is_pinned })}/>
                  <MI i={sel.is_muted ? "notifications_active" : "notifications_off"} l={sel.is_muted ? "Unmute" : "Mute"} o={() => act(`/api/conversations/${sel.id}/mute`, { muted: !sel.is_muted })}/>
                  <MI i="mark_email_unread" l="Mark unread" o={() => act(`/api/conversations/${sel.id}/unread`, { unread_count: 1 })}/>
                  <MI i="contact_page" l="Save contact" o={() => { saveContact(sel.id); setHeaderMenu(false); }}/>
                  <button onClick={e => { e.preventDefault(); e.stopPropagation(); setShowLabelMenu(showLabelMenu === sel.id ? null : sel.id); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] tr hover:bg-[var(--primary-muted)]" style={{ color: "var(--text-1)" }}><span className="material-symbols-rounded" style={{ fontSize: 18 }}>label</span><span className="flex-1 text-left">Labels</span><span className={`material-symbols-rounded tr ${showLabelMenu === sel.id ? "rotate-180" : ""}`} style={{ fontSize: 14 }}>expand_more</span></button>
                  {showLabelMenu === sel.id && <LabelSub convo={sel}/>}
                  <MI i="archive" l="Archive" o={() => { act(`/api/conversations/${sel.id}/archive`, { archived: true }); if (selId === sel.id) { setSelId(null); setMsgs([]); } }}/>
                  {user.role === "admin" && <><div style={{ height: 1, background: "var(--border)", margin: "2px 0" }}/><MI i="delete" l="Delete" o={() => delChat(sel.id)} d/></>}
                </div>}
              </div>
            </div>
          </div>

          {showChatSearch && <div className="px-4 py-2.5 flex items-center gap-2 anim-fade-up" style={{ background: "var(--bg-raised)", borderBottom: "1px solid var(--border)" }}><span className="material-symbols-rounded" style={{ fontSize: 18, color: "var(--text-4)" }}>search</span><input type="text" value={chatSearch} onChange={e => setChatSearch(e.target.value)} placeholder="Search in chat..." className="flex-1 bg-transparent text-[13px] focus:outline-none" style={{ color: "var(--text-1)" }} autoFocus/><button onClick={() => { setShowChatSearch(false); setChatSearch(""); }} style={{ color: "var(--text-4)" }}>✕</button></div>}

          {/* ── Messages ── */}
          <div ref={chatBoxRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-2.5 sm:px-12 lg:px-20 py-3 sm:py-4" style={{ background: "var(--chat-bg)" }}>
            {displayMsgs.map((msg, i) => {
              const isMe = msg.role === "assistant";
              const replied = msg.reply_to_id ? msgs.find(m => m.id === msg.reply_to_id) : null;
              return <div key={msg.id}>
                {sd(displayMsgs, i) && <div className="flex justify-center my-4"><span className="px-4 py-1.5 rounded-full text-[11px] font-semibold" style={{ background: "var(--surface-1)", color: "var(--text-3)", boxShadow: "var(--shadow-sm)" }}>{dl(msg.created_at)}</span></div>}
                <div className={`flex ${isMe ? "justify-end" : "justify-start"} ${msg.reaction ? "mb-5" : "mb-[3px]"} group/m`}>
                  <div className="relative max-w-[85%] sm:max-w-[65%]">
                    {replied && <div className="px-3 py-2 rounded-t-2xl text-[11px]" style={{ background: isMe ? "var(--bubble-me)" : "var(--bubble-them)", borderLeft: "3px solid var(--primary)", opacity: 0.85 }}><p className="font-bold text-[10px]" style={{ color: "var(--primary)" }}>{replied.role === "user" ? (sel?.name || sel?.phone) : "You"}</p><p className="truncate" style={{ color: "var(--text-3)" }}>{replied.content}</p></div>}
                    <div className={`relative px-3 py-[7px] ${msg.message_type === "sticker" ? "" : replied ? "rounded-b-2xl" : "rounded-2xl"}`} style={msg.message_type === "sticker" ? {} : { background: isMe ? "var(--bubble-me)" : "var(--bubble-them)", color: isMe ? "var(--bubble-me-text)" : "var(--bubble-them-text)", boxShadow: "var(--shadow-sm)", ...(isMe && !replied ? { borderTopRightRadius: "6px" } : !isMe && !replied ? { borderTopLeftRadius: "6px" } : {}) }}>
                      {!msg.is_deleted && <div className="absolute right-0 top-0 opacity-0 group-hover/m:opacity-100 z-10"><button onClick={e => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setMsgMenuPos(msgMenuId === msg.id ? null : { x: isMe ? rect.right : rect.left, y: rect.bottom + 4, isMe }); setMsgMenuId(msgMenuId === msg.id ? null : msg.id); setChatMenuId(null); setHeaderMenu(false); }} className="w-7 h-7 rounded-bl-xl flex items-center justify-center" style={{ background: isMe ? "var(--bubble-me)" : "var(--bubble-them)" }}><span className="material-symbols-rounded" style={{ fontSize: 16, color: "var(--text-3)" }}>expand_more</span></button></div>}
                      {media(msg)}
                      <div className="flex items-center justify-end gap-0.5 mt-0.5">{msg.is_starred && <span className="material-symbols-rounded" style={{ fontSize: 12, color: "#eab308", fontVariationSettings: "'FILL' 1" }}>star</span>}<span className="text-[10px]" style={{ color: isMe ? "var(--bubble-me-meta)" : "var(--text-4)" }}>{mt(msg.created_at)}</span>{isMe && si(msg.status || "sent")}</div>
                    </div>
                    {msg.reaction && <div className="absolute -bottom-3 rounded-full px-1.5 py-0.5 text-[12px] cursor-pointer hover:scale-110 tr" style={{ ...(isMe ? { right: 8 } : { left: 8 }), background: "var(--surface-1)", boxShadow: "var(--shadow-md)", border: "1px solid var(--border)" }} onClick={e => { e.stopPropagation(); reactMsg(msg.id, msg.reaction!); }}>{msg.reaction}</div>}
                    {reactPickerId === msg.id && <div className={`absolute ${isMe ? "right-0" : "left-0"} -top-12 z-[100] rounded-full px-2 py-1.5 flex gap-0.5 anim-scale-in`} style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>{QUICK_REACT.map(e => <button key={e} onClick={() => reactMsg(msg.id, e)} className="text-[18px] hover:scale-125 tr w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--primary-muted)]">{e}</button>)}</div>}
                  </div>
                </div>
              </div>;
            })}
            <div ref={endRef}/>
          </div>

          {/* Scroll to bottom */}
          {!isAtBottom && <div className="relative"><button onClick={scrollToBottom} className="absolute right-6 -top-14 w-10 h-10 rounded-full flex items-center justify-center z-20 tr" style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)" }}>{hasNewMsg && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: "var(--unread-badge)", color: "var(--unread-badge-text)" }}>!</span>}<span className="material-symbols-rounded" style={{ fontSize: 18, color: "var(--text-1)" }}>expand_more</span></button></div>}

          {/* Reply */}
          {replyTo && <div className="px-3 sm:px-10 lg:px-16 pt-2" style={{ background: "var(--bg-raised)" }}><div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "var(--surface-3)", borderLeft: "3px solid var(--primary)" }}><div className="flex-1 min-w-0"><p className="text-[11px] font-bold" style={{ color: "var(--primary)" }}>{replyTo.role === "user" ? (sel?.name || sel?.phone) : "You"}</p><p className="text-[12px] truncate" style={{ color: "var(--text-3)" }}>{replyTo.content}</p></div><button onClick={() => setReplyTo(null)} style={{ color: "var(--text-4)" }}>✕</button></div></div>}

          {/* ── Input Area ── */}
          <div className="relative" style={{ background: "var(--bg-raised)", borderTop: "1px solid var(--border)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>

            {/* ▓▓ Emoji Popup ▓▓ */}
            {(showEmoji || emojiClosing) && <>
              <div className="fixed inset-0 z-[50]" onClick={closeEmoji}/>
              <div className={`absolute bottom-full mb-2 z-[51] rounded-2xl overflow-hidden left-3 right-3 sm:left-4 sm:right-auto ${emojiClosing ? "anim-popup-close" : "anim-popup"}`} style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)", maxWidth: 340, maxHeight: 300 }} onClick={e => e.stopPropagation()}>
                <div className="flex px-2 py-1.5 gap-0.5 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
                  <button onClick={() => setEmojiCat("recent")} className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center tr" style={{ background: emojiCat === "recent" ? "var(--primary-muted)" : "transparent" }}><span className="material-symbols-rounded" style={{ fontSize: 18, color: emojiCat === "recent" ? "var(--primary)" : "var(--text-3)" }}>schedule</span></button>
                  {Object.keys(EMOJIS).map(c => <button key={c} onClick={() => setEmojiCat(c)} className="text-[18px] w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center tr" style={{ background: emojiCat === c ? "var(--primary-muted)" : "transparent" }}>{c}</button>)}
                </div>
                <div className="p-2.5 overflow-y-auto" style={{ height: 220 }}>
                  {emojiCat === "recent" ? (
                    recentEmojis.length === 0 ? <p className="text-center py-6 text-[12px]" style={{ color: "var(--text-4)" }}>No recent emojis yet</p> :
                    <div className="flex flex-wrap gap-0.5">{recentEmojis.map((em, i) => <button key={i} onClick={() => { addRecentEmoji(em); setInput(p => p + em); closeEmoji(); inputRef.current?.focus(); }} className="w-10 h-10 text-[22px] rounded-lg flex items-center justify-center tr hover:bg-[var(--primary-muted)] hover:scale-110">{em}</button>)}</div>
                  ) : (
                    <div className="flex flex-wrap gap-0.5">{EMOJIS[emojiCat]?.map((em, i) => <button key={i} onClick={() => { addRecentEmoji(em); setInput(p => p + em); closeEmoji(); inputRef.current?.focus(); }} className="w-10 h-10 text-[22px] rounded-lg flex items-center justify-center tr hover:bg-[var(--primary-muted)] hover:scale-110">{em}</button>)}</div>
                  )}
                </div>
              </div>
            </>}

            {/* ▓▓ Quick Replies Popup ▓▓ */}
            {(showQuickReplies || qrClosing) && <>
              <div className="fixed inset-0 z-[50]" onClick={closeQR}/>
              <div className={`absolute bottom-full mb-2 z-[51] rounded-2xl overflow-hidden left-3 right-3 sm:left-4 sm:right-auto ${qrClosing ? "anim-popup-close" : "anim-popup"}`} style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)", maxWidth: 400, maxHeight: 380 }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2"><span className="material-symbols-rounded" style={{ fontSize: 18, color: "var(--primary)", fontVariationSettings: "'FILL' 1" }}>bolt</span><span className="text-[13px] font-bold" style={{ color: "var(--text-1)" }}>Quick Replies</span></div>
                  <div className="flex gap-1.5">
                    {qrMode === "list" && <button onClick={() => { setQrMode("add"); setQrTitle(""); setQrContent(""); setQrCategory(""); }} className="text-[11px] px-3 py-1 rounded-lg font-bold" style={{ background: "var(--primary)", color: "var(--primary-text)" }}>+ New</button>}
                    {qrMode !== "list" && <button onClick={() => { setQrMode("list"); setQrEditId(null); }} className="text-[11px] px-2 py-1 font-medium" style={{ color: "var(--text-3)" }}>← Back</button>}
                    <button onClick={closeQR} className="w-7 h-7 rounded-lg flex items-center justify-center tr hover:bg-[var(--surface-3)]" style={{ color: "var(--text-4)" }}><span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span></button>
                  </div>
                </div>
                {qrMode === "list" && <>
                  <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}><input type="text" value={qrSearch} onChange={e => setQrSearch(e.target.value)} placeholder="Search..." className="w-full rounded-lg px-3 py-1.5 text-[12px] focus:outline-none" style={{ background: "var(--surface-3)", color: "var(--text-1)" }}/></div>
                  <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
                    {quickReplies.filter(qr => !qrSearch || qr.title.toLowerCase().includes(qrSearch.toLowerCase()) || qr.content.toLowerCase().includes(qrSearch.toLowerCase())).length === 0 ? <div className="px-4 py-8 text-center text-[13px]" style={{ color: "var(--text-4)" }}>{quickReplies.length === 0 ? "No quick replies yet" : "No matches"}</div> : quickReplies.filter(qr => !qrSearch || qr.title.toLowerCase().includes(qrSearch.toLowerCase()) || qr.content.toLowerCase().includes(qrSearch.toLowerCase())).map(qr => <div key={qr.id} className="flex items-start gap-2 px-4 py-3 group cursor-pointer tr hover:bg-[var(--surface-3)]" style={{ borderBottom: "1px solid var(--border)" }} onClick={() => useQuickReply(qr)}>
                      <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-[12px] font-bold" style={{ color: "var(--primary)" }}>{qr.title}</span>{qr.category && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--surface-4)", color: "var(--text-4)" }}>{qr.category}</span>}<span className="text-[10px] ml-auto" style={{ color: "var(--text-4)" }}>{qr.usage_count}x</span></div><p className="text-[12px] truncate mt-0.5" style={{ color: "var(--text-3)" }}>{qr.content}</p></div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0"><button onClick={e => { e.stopPropagation(); setQrMode("edit"); setQrEditId(qr.id); setQrTitle(qr.title); setQrContent(qr.content); setQrCategory(qr.category || ""); }} className="w-7 h-7 rounded-md flex items-center justify-center tr hover:bg-[var(--surface-4)]" style={{ color: "var(--text-3)" }}><span className="material-symbols-rounded" style={{ fontSize: 15 }}>edit</span></button><button onClick={e => { e.stopPropagation(); deleteQuickReply(qr.id); }} className="w-7 h-7 rounded-md flex items-center justify-center tr hover:bg-[var(--danger-muted)]" style={{ color: "var(--danger)" }}><span className="material-symbols-rounded" style={{ fontSize: 15 }}>delete</span></button></div>
                    </div>)}
                  </div>
                </>}
                {(qrMode === "add" || qrMode === "edit") && <div className="px-4 py-3 space-y-2.5">
                  <input type="text" value={qrTitle} onChange={e => setQrTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none" style={{ background: "var(--surface-3)", color: "var(--text-1)" }}/>
                  <textarea value={qrContent} onChange={e => setQrContent(e.target.value)} placeholder="Message... Use {name} for customer name" rows={3} className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none resize-none" style={{ background: "var(--surface-3)", color: "var(--text-1)" }}/>
                  <input type="text" value={qrCategory} onChange={e => setQrCategory(e.target.value)} placeholder="Category (optional)" className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none" style={{ background: "var(--surface-3)", color: "var(--text-1)" }}/>
                  <button onClick={qrMode === "edit" ? updateQuickReply : createQuickReply} disabled={!qrTitle.trim() || !qrContent.trim()} className="w-full py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-30 tr" style={{ background: "var(--primary)", color: "var(--primary-text)" }}>{qrMode === "edit" ? "Update" : "Save"}</button>
                </div>}
              </div>
            </>}

            {/* Input Bar */}
            <div className="px-3 sm:px-10 lg:px-16 py-2.5 sm:py-3 flex items-end gap-1.5 sm:gap-2">
              <button onClick={e => { e.stopPropagation(); if (showEmoji) closeEmoji(); else { setShowEmoji(true); setShowQuickReplies(false); setQrClosing(false); } }} className={`${s.iconBtn} hidden sm:flex`} style={{ color: showEmoji ? "var(--primary)" : "var(--text-3)", background: showEmoji ? "var(--primary-muted)" : "transparent" }}><span className="material-symbols-rounded" style={{ fontSize: 22 }}>mood</span></button>
              <button onClick={e => { e.stopPropagation(); if (showQuickReplies) closeQR(); else { setShowQuickReplies(true); setShowEmoji(false); setEmojiClosing(false); setQrMode("list"); setQrSearch(""); } }} className={s.iconBtn} style={{ color: showQuickReplies ? "var(--primary)" : "var(--text-3)", background: showQuickReplies ? "var(--primary-muted)" : "transparent" }} title="Quick Replies"><span className="material-symbols-rounded" style={{ fontSize: 22 }}>bolt</span></button>
              <button onClick={() => document.getElementById("file-input")?.click()} className={s.iconBtn} style={{ color: "var(--text-3)" }} title="Attach"><span className="material-symbols-rounded" style={{ fontSize: 22 }}>attach_file</span></button>
              <input id="file-input" type="file" className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" onChange={async e => { const f = e.target.files?.[0]; if (!f || !selId) return; const ic = f.type.startsWith("image/") ? "📷" : f.type.startsWith("video/") ? "🎥" : "📄"; const tid = `temp_file_${Date.now()}`; addOptimisticMsg(tid, `${ic} Sending ${f.name}...`, f.type.startsWith("image/") ? "image" : "document"); setSending(true); try { const fd = new FormData(); fd.append("file", f); fd.append("caption", ""); const res = await fetch(`/api/conversations/${selId}/send-media`, { method: "POST", body: fd }); if (!res.ok) { setMsgs(p => p.filter(m => m.id !== tid)); const d = await res.json(); alert("Error: " + JSON.stringify(d)); setSending(false); } else { const real = await res.json(); lastSentIdsRef.current.add(real.id); setMsgs(p => p.map(m => m.id === tid ? { ...real } : m)); setTimeout(() => { setSending(false); setTimeout(() => lastSentIdsRef.current.delete(real.id), 10000); }, 3000); } } catch (err) { setMsgs(p => p.filter(m => m.id !== tid)); alert("Error: " + String(err)); setSending(false); } finally { e.target.value = ""; } }}/>
              <div className="flex-1 rounded-2xl px-4 py-2.5 relative cursor-text" onClick={() => inputRef.current?.focus()} style={{ background: "var(--surface-3)", border: `1.5px solid ${inputFocused ? "var(--primary)" : "var(--border)"}`, transition: "border-color 0.2s ease" }}>
                {slashActive && (() => {
                  const matches = quickReplies.filter(qr => !slashQuery || qr.title.toLowerCase().includes(slashQuery.toLowerCase()));
                  if (matches.length === 0) return null;
                  return <div className="absolute bottom-full mb-2 left-0 right-0 z-[52] rounded-xl overflow-hidden anim-scale-in" style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)" }}>
                    <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                      <span className="text-[12px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--primary-muted)", color: "var(--primary)" }}>/</span>
                      <span className="text-[12px] font-medium" style={{ color: "var(--text-3)" }}>Quick replies</span>
                      <span className="text-[10px] ml-auto hidden sm:block" style={{ color: "var(--text-4)" }}>↑↓ Enter</span>
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
                      {matches.map((qr, i) => <button key={qr.id} onClick={() => selectSlashQR(qr)} className="w-full flex items-start gap-2 px-3 py-2.5 text-left tr" style={{ background: i === slashIdx ? "var(--primary-muted)" : "transparent" }}>
                        <span className="text-[12px] font-bold flex-shrink-0" style={{ color: "var(--primary)" }}>{qr.title}</span>
                        <span className="text-[11px] truncate flex-1" style={{ color: "var(--text-3)" }}>{qr.content}</span>
                      </button>)}
                    </div>
                  </div>;
                })()}
                <textarea ref={inputRef} value={input} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} onChange={e => {
                  const v = e.target.value; setInput(v);
                  smoothResizeInput();
                  if (v.startsWith("/")) { setSlashActive(true); setSlashQuery(v.slice(1)); setSlashIdx(0); }
                  else { setSlashActive(false); setSlashQuery(""); }
                }} onKeyDown={e => {
                  if (slashActive) {
                    const matches = quickReplies.filter(qr => !slashQuery || qr.title.toLowerCase().includes(slashQuery.toLowerCase()));
                    if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx(i => Math.min(i + 1, matches.length - 1)); }
                    else if (e.key === "ArrowUp") { e.preventDefault(); setSlashIdx(i => Math.max(i - 1, 0)); }
                    else if (e.key === "Enter" && matches[slashIdx]) { e.preventDefault(); selectSlashQR(matches[slashIdx]); }
                    else if (e.key === "Escape") { setSlashActive(false); }
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey && !isMobile) { e.preventDefault(); handleSend(); }
                }} placeholder="Type or / for quick replies" rows={1} className="w-full bg-transparent text-[14px] focus:outline-none resize-none leading-[1.5] max-h-[120px] overflow-y-auto" style={{ color: "var(--text-1)", height: "auto", transition: "height 0.15s ease" }}/>
              </div>
              <button onClick={handleSend} disabled={sending || !input.trim()} className="w-10 h-10 rounded-xl disabled:opacity-20 tr flex items-center justify-center flex-shrink-0 shadow-sm hover:shadow-md" style={{ background: "var(--primary)" }}>
                {sending ? <span className="material-symbols-rounded animate-spin" style={{ fontSize: 20, color: "var(--primary-text)" }}>progress_activity</span>
                : <span className="material-symbols-rounded" style={{ fontSize: 20, color: "var(--primary-text)", fontVariationSettings: "'FILL' 1" }}>send</span>}
              </button>
            </div>
          </div>
        </>)}
      </div>

      {/* ▓▓ Labels Modal ▓▓ */}
      {showLabelsModal && (() => {
        const adminLabels = labels.filter(l => l.created_by_role === "admin" || !l.created_by_role);
        const userGroups: Record<string, typeof labels> = {};
        labels.filter(l => l.created_by_role === "user").forEach(l => {
          const key = l.created_by_name || l.created_by_email || "Unknown";
          if (!userGroups[key]) userGroups[key] = [];
          userGroups[key].push(l);
        });
        const canDelete = (l: typeof labels[0]) => {
          if (user?.role === "admin") return true; // admin deletes all
          if (l.created_by_email === user?.email) return true; // own label
          return false;
        };
        return <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "var(--bg-overlay)", backdropFilter: "blur(8px)" }} onClick={() => setShowLabelsModal(false)}>
          <div className="rounded-2xl w-[420px] max-h-[560px] overflow-hidden anim-scale-in" style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-rounded" style={{ fontSize: 22, color: "var(--primary)" }}>label</span>
                <h3 className="text-[16px] font-bold" style={{ color: "var(--text-1)" }}>Labels</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--surface-3)", color: "var(--text-3)" }}>{labels.length}</span>
              </div>
              <button onClick={() => setShowLabelsModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center tr hover:bg-[var(--surface-3)]" style={{ color: "var(--text-3)" }}><span className="material-symbols-rounded" style={{ fontSize: 20 }}>close</span></button>
            </div>

            {/* Create */}
            <div className="px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex gap-2 items-center mb-2.5">
                <input type="text" value={newLabelName} onChange={e => setNewLabelName(e.target.value)} placeholder="New label name..." onKeyDown={e => e.key === "Enter" && createLabel()} className="flex-1 rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none tr" style={{ background: "var(--surface-3)", color: "var(--text-1)", border: "1.5px solid transparent" }} onFocus={e => e.target.style.borderColor = "var(--border-focus)"} onBlur={e => e.target.style.borderColor = "transparent"}/>
                <button onClick={createLabel} disabled={!newLabelName.trim()} className="h-10 px-4 rounded-xl text-[13px] font-bold disabled:opacity-30 tr flex items-center gap-1.5" style={{ background: "var(--primary)", color: "var(--primary-text)" }}><span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>Add</button>
              </div>
              <div className="flex gap-2">
                {LABEL_COLORS.map(c => <button key={c} onClick={() => setNewLabelColor(c)} className="w-7 h-7 rounded-full tr hover:scale-110" style={{ background: c, boxShadow: newLabelColor === c ? `0 0 0 2.5px var(--surface-1), 0 0 0 4.5px ${c}` : "none" }}/>)}
              </div>
            </div>

            {/* Label List — Grouped */}
            <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
              {labels.length === 0 && <div className="px-5 py-10 text-center"><span className="material-symbols-rounded" style={{ fontSize: 36, color: "var(--text-4)" }}>label_off</span><p className="text-[13px] mt-2" style={{ color: "var(--text-4)" }}>No labels yet</p></div>}

              {/* Admin Labels */}
              {adminLabels.length > 0 && <>
                <div className="px-5 pt-3 pb-1.5 flex items-center gap-2">
                  <span className="material-symbols-rounded" style={{ fontSize: 14, color: "var(--primary)" }}>shield</span>
                  <p className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--text-4)" }}>Admin Labels</p>
                </div>
                {adminLabels.map(l => <div key={l.id} className="flex items-center gap-3 px-5 py-2.5 group/l tr" onMouseEnter={e => e.currentTarget.style.background = "var(--surface-3)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm" style={{ background: l.color }}/>
                  <span className="text-[13.5px] flex-1 font-medium" style={{ color: "var(--text-1)" }}>{l.name}</span>
                  {canDelete(l) && <button onClick={() => deleteLabel(l.id)} className="opacity-0 group-hover/l:opacity-70 hover:!opacity-100 tr w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: "var(--danger)", background: "var(--danger-muted)" }}><span className="material-symbols-rounded" style={{ fontSize: 15 }}>delete</span></button>}
                </div>)}
              </>}

              {/* User Labels — grouped by creator */}
              {Object.entries(userGroups).map(([creator, lbls]) => <div key={creator}>
                <div className="px-5 pt-3 pb-1.5 flex items-center gap-2">
                  <span className="material-symbols-rounded" style={{ fontSize: 14, color: "var(--text-3)" }}>person</span>
                  <p className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--text-4)" }}>{creator}</p>
                </div>
                {lbls.map(l => <div key={l.id} className="flex items-center gap-3 px-5 py-2.5 group/l tr" onMouseEnter={e => e.currentTarget.style.background = "var(--surface-3)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm" style={{ background: l.color }}/>
                  <span className="text-[13.5px] flex-1 font-medium" style={{ color: "var(--text-1)" }}>{l.name}</span>
                  {canDelete(l) && <button onClick={() => deleteLabel(l.id)} className="opacity-0 group-hover/l:opacity-70 hover:!opacity-100 tr w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: "var(--danger)", background: "var(--danger-muted)" }}><span className="material-symbols-rounded" style={{ fontSize: 15 }}>delete</span></button>}
                </div>)}
              </div>)}
            </div>
          </div>
        </div>;
      })()}

      {/* ▓▓ 2FA Settings Modal ▓▓ */}
      {show2FA && <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "var(--bg-overlay)", backdropFilter: "blur(8px)" }} onClick={() => setShow2FA(false)}>
        <div className="rounded-2xl w-full max-w-[380px] max-h-[90vh] flex flex-col anim-scale-in" style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
          {/* Header — fixed */}
          <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded" style={{ fontSize: 20, color: "var(--primary)" }}>security</span>
              <h3 className="text-[15px] font-bold" style={{ color: "var(--text-1)" }}>Two-Factor Auth</h3>
            </div>
            <button onClick={() => setShow2FA(false)} className="w-8 h-8 rounded-lg flex items-center justify-center tr hover:bg-[var(--surface-3)]" style={{ color: "var(--text-3)" }}><span className="material-symbols-rounded" style={{ fontSize: 20 }}>close</span></button>
          </div>

          {/* Content — scrollable */}
          <div className="overflow-y-auto px-4 py-4">
            {mfaError && <div className="mb-3 px-3 py-2.5 rounded-xl text-[12px] font-medium flex items-center gap-2" style={{ background: "var(--danger-muted)", color: "var(--danger)" }}><span className="material-symbols-rounded" style={{ fontSize: 16 }}>error</span>{mfaError}</div>}

            {/* Idle */}
            {mfa2FAState === "idle" && <div className="text-center py-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--surface-3)" }}><span className="material-symbols-rounded" style={{ fontSize: 28, color: "var(--text-4)" }}>shield</span></div>
              <p className="text-[14px] font-bold mb-1" style={{ color: "var(--text-1)" }}>2FA is disabled</p>
              <p className="text-[12px] mb-4" style={{ color: "var(--text-3)" }}>Add extra security using an authenticator app</p>
              <button onClick={enroll2FA} className="w-full font-bold py-2.5 rounded-xl text-[13px] flex items-center justify-center gap-2 tr" style={{ background: "var(--primary)", color: "var(--primary-text)" }}><span className="material-symbols-rounded" style={{ fontSize: 18 }}>qr_code_2</span>Enable 2FA</button>
            </div>}

            {/* Enrolling */}
            {mfa2FAState === "enrolling" && <div className="text-center py-6"><div className="w-5 h-5 border-2 rounded-full animate-spin mx-auto mb-2" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}/><p className="text-[12px]" style={{ color: "var(--text-3)" }}>Generating QR code...</p></div>}

            {/* Verifying — QR + secret + code input */}
            {mfa2FAState === "verifying" && <div>
              <p className="text-[13px] font-bold text-center mb-0.5" style={{ color: "var(--text-1)" }}>Scan this QR code</p>
              <p className="text-[11px] text-center mb-3" style={{ color: "var(--text-3)" }}>Google Authenticator → + → Scan</p>

              <div className="flex justify-center mb-3">
                <div className="p-2 rounded-xl" style={{ background: "#fff" }}>
                  <img src={mfaQR} alt="QR" className="w-[140px] h-[140px]"/>
                </div>
              </div>

              <p className="text-[10px] font-semibold mb-1 tracking-wide" style={{ color: "var(--text-4)" }}>OR ENTER MANUALLY</p>
              <div className="flex items-center gap-1.5 rounded-lg px-3 py-2 mb-3" style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}>
                <code className="flex-1 text-[11px] font-mono font-bold tracking-wider" style={{ color: "var(--primary)", wordBreak: "break-all" }}>{mfaSecret}</code>
                <button onClick={() => navigator.clipboard.writeText(mfaSecret)} className="w-7 h-7 rounded-md flex items-center justify-center tr" style={{ color: "var(--primary)" }}><span className="material-symbols-rounded" style={{ fontSize: 16 }}>content_copy</span></button>
              </div>

              <p className="text-[10px] font-semibold mb-1.5 tracking-wide" style={{ color: "var(--text-4)" }}>VERIFY CODE</p>
              <input type="text" inputMode="numeric" maxLength={6} value={mfaVerifyCode} onChange={e => { if (/^\d*$/.test(e.target.value)) setMfaVerifyCode(e.target.value); }} placeholder="000000" className="w-full rounded-lg px-3 py-2.5 text-[18px] font-bold tracking-[0.3em] text-center focus:outline-none tr mb-3" style={{ background: "var(--surface-3)", color: "var(--text-1)", border: "1.5px solid var(--border)" }} onFocus={e => e.target.style.borderColor = "var(--border-focus)"} onBlur={e => e.target.style.borderColor = "var(--border)"} onKeyDown={e => e.key === "Enter" && verify2FAEnrollment()}/>

              <button onClick={verify2FAEnrollment} disabled={mfaVerifyCode.length !== 6} className="w-full font-bold py-2.5 rounded-xl text-[13px] flex items-center justify-center gap-2 tr disabled:opacity-40" style={{ background: "var(--primary)", color: "var(--primary-text)" }}><span className="material-symbols-rounded" style={{ fontSize: 16 }}>verified_user</span>Verify & Enable</button>
            </div>}

            {/* Enabled */}
            {mfa2FAState === "enabled" && <div className="text-center py-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "var(--primary-muted)" }}><span className="material-symbols-rounded" style={{ fontSize: 28, color: "var(--primary)", fontVariationSettings: "'FILL' 1" }}>verified_user</span></div>
              <p className="text-[14px] font-bold mb-1" style={{ color: "var(--text-1)" }}>2FA is enabled</p>
              <p className="text-[12px] mb-4" style={{ color: "var(--text-3)" }}>Your account is protected</p>
              <button onClick={disable2FA} className="w-full font-bold py-2.5 rounded-xl text-[13px] flex items-center justify-center gap-2 tr" style={{ background: "var(--danger-muted)", color: "var(--danger)" }}><span className="material-symbols-rounded" style={{ fontSize: 16 }}>shield</span>Disable 2FA</button>
            </div>}
          </div>
        </div>
      </div>}

      {/* ▓▓ Fixed Message Menu ▓▓ */}
      {msgMenuId && msgMenuPos && (() => {
        const curMsg = msgs.find(m => m.id === msgMenuId);
        if (!curMsg) return null;
        const menuH = 220; // approx height of 5 items
        const flipUp = msgMenuPos.y + menuH > window.innerHeight - 20;
        return <div className="fixed z-[200] anim-scale-in rounded-2xl py-1.5 min-w-[200px]" style={{ top: flipUp ? msgMenuPos.y - menuH - 40 : msgMenuPos.y, left: msgMenuPos.isMe ? undefined : msgMenuPos.x, right: msgMenuPos.isMe ? window.innerWidth - msgMenuPos.x : undefined, background: "var(--surface-2)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)", backdropFilter: "blur(20px)" }} onClick={e => e.stopPropagation()}>
          <MI i="reply" l="Reply" o={() => { setReplyTo(curMsg); setMsgMenuId(null); setMsgMenuPos(null); inputRef.current?.focus(); }}/>
          <MI i="add_reaction" l="React" o={() => { setReactPickerId(curMsg.id); setMsgMenuId(null); setMsgMenuPos(null); }}/>
          <MI i={curMsg.is_starred ? "star" : "star_outline"} l={curMsg.is_starred ? "Unstar" : "Star"} o={() => { starMsg(curMsg.id, !curMsg.is_starred); setMsgMenuPos(null); }}/>
          <MI i="content_copy" l="Copy" o={() => { navigator.clipboard.writeText(curMsg.content); setMsgMenuId(null); setMsgMenuPos(null); }}/>
          <MI i="forward" l="Forward" o={() => { setForwardMsg(curMsg); setForwardSelected(new Set()); setMsgMenuId(null); setMsgMenuPos(null); }}/>
        </div>;
      })()}

      {/* ▓▓ Image Preview ▓▓ */}
      {imgPreview && <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "var(--bg-overlay)", backdropFilter: "blur(12px)" }} onClick={() => setImgPreview(null)}><button className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ background: "rgba(255,255,255,0.15)" }}>✕</button><img src={imgPreview} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}/></div>}

      {/* ▓▓ Forward Modal ▓▓ */}
      {forwardMsg && <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "var(--bg-overlay)", backdropFilter: "blur(8px)" }} onClick={() => { setForwardMsg(null); setForwardSelected(new Set()); }}>
        <div className="rounded-2xl w-[380px] max-h-[520px] overflow-hidden anim-scale-in" style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}><h3 className="text-[14px] font-bold" style={{ color: "var(--text-1)" }}>Forward to</h3><button onClick={() => { setForwardMsg(null); setForwardSelected(new Set()); }} style={{ color: "var(--text-4)" }}>✕</button></div>
          <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}><div className="rounded-lg px-3 py-1.5 text-[12px] truncate" style={{ background: "var(--surface-3)", color: "var(--text-3)" }}>{forwardMsg.content?.substring(0, 100)}</div></div>
          {forwardSelected.size > 0 && <div className="px-3 py-2 flex flex-wrap gap-1.5" style={{ borderBottom: "1px solid var(--border)" }}>{Array.from(forwardSelected).map(id => { const c = convos.find(x => x.id === id); return c ? <span key={id} className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium" style={{ background: "var(--primary-muted)", color: "var(--primary)" }}>{c.name || c.phone}<button onClick={() => { const ns = new Set(forwardSelected); ns.delete(id); setForwardSelected(ns); }}>✕</button></span> : null; })}</div>}
          <div className="overflow-y-auto max-h-[320px]">{convos.filter(c => c.id !== forwardMsg.conversation_id).map(c => { const is = forwardSelected.has(c.id); return <button key={c.id} onClick={() => { const ns = new Set(forwardSelected); if (is) ns.delete(c.id); else ns.add(c.id); setForwardSelected(ns); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left tr" style={{ background: is ? "var(--primary-muted)" : "transparent" }}><div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 tr" style={{ background: is ? "var(--primary)" : "transparent", borderColor: is ? "var(--primary)" : "var(--text-4)" }}>{is && <span className="material-symbols-rounded text-white" style={{ fontSize: 14 }}>check</span>}</div><div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${aclr(c.id)} flex items-center justify-center text-white text-[11px] font-bold`}>{ini(c.name, c.phone)}</div><p className="text-[13px] font-medium truncate" style={{ color: "var(--text-1)" }}>{c.name || c.phone}</p></button>; })}</div>
          {forwardSelected.size > 0 && <div className="px-4 py-3 flex justify-end" style={{ borderTop: "1px solid var(--border)" }}><button onClick={() => forwardMessage(forwardMsg.id, Array.from(forwardSelected))} className="font-bold px-6 py-2.5 rounded-xl text-[13px] flex items-center gap-2 shadow-md tr" style={{ background: "var(--primary)", color: "var(--primary-text)" }}><span className="material-symbols-rounded" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>send</span>Send ({forwardSelected.size})</button></div>}
        </div>
      </div>}

      {(chatMenuId || msgMenuId || headerMenu || reactPickerId || sidebarMenu) && <div className="fixed inset-0 z-[90]" onClick={() => { setChatMenuId(null); setMsgMenuId(null); setMsgMenuPos(null); setHeaderMenu(false); setReactPickerId(null); setShowLabelMenu(null); setChatLabelOpen(null); setShowQuickReplies(false); setSidebarMenu(false); }}/>}
    </div>
  );
}

/* ═══ MENU ITEM ═══ */
function MI({ i, l, o, d }: { i: string; l: string; o: () => void; d?: boolean }) {
  return <button onClick={o} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] tr" style={{ color: d ? "var(--danger)" : "var(--text-1)" }} onMouseEnter={e => e.currentTarget.style.background = d ? "var(--danger-muted)" : "var(--primary-muted)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><span className="material-symbols-rounded" style={{ fontSize: 18 }}>{i}</span><span className="font-medium">{l}</span></button>;
}
