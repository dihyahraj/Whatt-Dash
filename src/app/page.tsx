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
  const [filter, setFilter] = useState<"all" | "unread" | string>("all"); // "all", "unread", or label_id
  const [labels, setLabels] = useState<Label[]>([]);
  const [showLabelMenu, setShowLabelMenu] = useState<string | null>(null); // header menu labels
  const [chatLabelOpen, setChatLabelOpen] = useState<string | null>(null); // sidebar menu labels
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

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMsg, setHasNewMsg] = useState(false);
  
  const sel = convos.find((c) => c.id === selId);

  // Fetch
  const fetchConvos = useCallback(async () => { if (skipPollRef.current) return; try { const r = await fetch("/api/conversations"); if (skipPollRef.current) return; const d = await r.json(); if (skipPollRef.current) return; if (Array.isArray(d)) setConvos(d); } catch {} }, []);
  const sendingRef = useRef(false);
  const lastSentIdsRef = useRef<Set<string>>(new Set());
  const skipPollRef = useRef(false);

  const fetchMsgs = useCallback(async (id: string) => {
    if (sendingRef.current || skipPollRef.current) return;
    try {
      const r = await fetch(`/api/conversations/${id}/messages`);
      if (sendingRef.current || skipPollRef.current) return;
      const d = await r.json();
      if (sendingRef.current || skipPollRef.current) return;
      if (Array.isArray(d)) setMsgs(d);
    } catch {}
  }, []);
  const fetchArchived = useCallback(async () => { if (skipPollRef.current) return; try { const r = await fetch("/api/conversations/archived"); if (skipPollRef.current) return; const d = await r.json(); if (skipPollRef.current) return; if (Array.isArray(d)) setArchived(d); } catch {} }, []);
  const fetchLabels = useCallback(async () => { try { const r = await fetch("/api/labels"); const d = await r.json(); if (Array.isArray(d)) setLabels(d); } catch {} }, []);
  const fetchQuickReplies = useCallback(async () => { try { const r = await fetch("/api/quick-replies"); const d = await r.json(); if (Array.isArray(d)) setQuickReplies(d); } catch {} }, []);

  async function createQuickReply() {
    if (!qrTitle.trim() || !qrContent.trim()) return;
    try {
      const r = await fetch("/api/quick-replies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: qrTitle, content: qrContent, category: qrCategory || null }) });
      if (r.ok) { fetchQuickReplies(); setQrTitle(""); setQrContent(""); setQrCategory(""); setQrMode("list"); }
    } catch {}
  }
  async function updateQuickReply() {
    if (!qrEditId || !qrTitle.trim() || !qrContent.trim()) return;
    try {
      const r = await fetch(`/api/quick-replies/${qrEditId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: qrTitle, content: qrContent, category: qrCategory || null }) });
      if (r.ok) { fetchQuickReplies(); setQrTitle(""); setQrContent(""); setQrCategory(""); setQrEditId(null); setQrMode("list"); }
    } catch {}
  }
  async function deleteQuickReply(id: string) {
    if (!confirm("Delete this quick reply?")) return;
    try { await fetch(`/api/quick-replies/${id}`, { method: "DELETE" }); fetchQuickReplies(); } catch {}
  }
  function useQuickReply(qr: QuickReply) {
    // Replace {name} and {phone} with current chat info
    let text = qr.content;
    if (sel) { text = text.replace(/\{name\}/g, sel.name || sel.phone).replace(/\{phone\}/g, sel.phone); }
    setInput(text);
    setShowQuickReplies(false);
    inputRef.current?.focus();
    fetch(`/api/quick-replies/${qr.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ use: true }) }).catch(() => {});
  }

  useEffect(() => { fetchConvos(); fetchArchived(); fetchLabels(); fetchQuickReplies(); }, [fetchConvos, fetchArchived, fetchLabels, fetchQuickReplies]);
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
      if (skipPollRef.current || sendingRef.current) return; // Skip entire cycle
      fetchConvos();
      if (selId) {
        fetchMsgs(selId);
        fetch(`/api/conversations/${selId}/read`, { method: "POST" }).catch(() => {});
        setConvos((p) => p.map((c) => c.id === selId ? { ...c, unread_count: 0 } : c));
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [fetchConvos, fetchMsgs, selId]);

  // Realtime + Notifications

  // Notification helper
  function notifyNewMsg(msg: Message) {
    const c = convos.find((x) => x.id === msg.conversation_id);
    if (c?.is_muted) return; // Muted chat — no notification, no sound
    const title = c?.name || c?.phone || "New Message";
    const body = msg.content?.substring(0, 100) || "New message";
    // Browser notification
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico", tag: msg.conversation_id });
    }
    // Sound - WhatsApp-like notification beep
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }

  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel("rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as Message;
        if (m.conversation_id === selId) {
          setMsgs((prev) => {
            // Skip if already exists or recently sent by us
            if (prev.some((x) => x.id === m.id)) return prev;
            if (lastSentIdsRef.current.has(m.id)) return prev;
            // If there's a temp msg with same content, replace it
            const tempIdx = prev.findIndex((x) => x.id.startsWith("temp_") && x.content === m.content && x.role === m.role);
            if (tempIdx >= 0) {
              const updated = [...prev];
              updated[tempIdx] = m;
              return updated;
            }
            // Skip own msgs while sending
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

  // Tab title with unread count
  useEffect(() => {
    const total = convos.reduce((s, c) => s + (c.unread_count || 0), 0);
    document.title = total > 0 ? `(${total}) Whatt Dash` : "Whatt Dash";
  }, [convos]);

  // Send
  async function handleSend() {
    if (!input.trim() || !selId || sending) return;
    const text = input.trim();
    const reply = replyTo;
    
    // Optimistic: show message immediately
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId, conversation_id: selId, role: "assistant", content: text,
      message_type: "text", media_url: null, media_mime_type: null, media_filename: null,
      media_caption: null, media_sha256: null, reply_to_id: reply?.id || null,
      reaction: null, reaction_msg_id: null, latitude: null, longitude: null,
      location_name: null, location_address: null, whatsapp_msg_id: null,
      is_deleted: false, is_starred: false, status: "sent",
      created_at: new Date().toISOString(),
    };
    setMsgs((p) => [...p, optimisticMsg]);
    setInput(""); setReplyTo(null);
    if (inputRef.current) inputRef.current.style.height = "auto";
    setIsAtBottom(true); // auto-scroll for own messages
    
    setSending(true);
    try {
      const b: Record<string, string> = { message: text };
      if (reply) { b.replyToMsgId = reply.id; if (reply.whatsapp_msg_id) b.replyToWhatsappId = reply.whatsapp_msg_id; }
      const r = await fetch(`/api/conversations/${selId}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
      if (!r.ok) {
        // Remove optimistic message on error
        setMsgs((p) => p.filter((m) => m.id !== tempId));
        const d = await r.json(); alert("Error:\n" + JSON.stringify(d, null, 2));
        setInput(text); // restore input
        return;
      }
      const real = await r.json();
      // Replace temp with real message, track ID to prevent duplicates
      lastSentIdsRef.current.add(real.id);
      setMsgs((p) => p.map((m) => m.id === tempId ? { ...real } : m));
      // Keep sendingRef true for 3 more seconds to block polling/realtime duplicates
      setTimeout(() => { 
        setSending(false);
        // Clean up after 10s
        setTimeout(() => { lastSentIdsRef.current.delete(real.id); }, 10000);
      }, 3000);
    } catch (e) {
      setMsgs((p) => p.filter((m) => m.id !== tempId));
      setInput(text);
      alert("Network Error: " + String(e));
      setSending(false);
    }
  }

  // Chat actions
  // ═══ OPTIMISTIC ACTIONS — UI updates instantly, backend in background ═══
  
  function closeMenus() { setChatMenuId(null); setHeaderMenu(false); setMsgMenuId(null); }
  
  // Pause polling so it doesn't overwrite optimistic state
  function pausePoll(ms = 4000) {
    skipPollRef.current = true;
    setTimeout(() => { skipPollRef.current = false; }, ms);
  }

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

  // Delete chat — instant remove
  async function delChat(id: string) {
    if (!confirm("Are you sure you want to delete this chat?")) return;
    closeMenus(); pausePoll();
    setConvos((p) => p.filter((c) => c.id !== id));
    setArchived((p) => p.filter((c) => c.id !== id));
    if (selId === id) { setSelId(null); setMsgs([]); }
    fetch(`/api/conversations/${id}/delete`, { method: "POST" }).catch(() => {});
  }

  // Unarchive — instant move
  async function unarchive(id: string) {
    pausePoll();
    const chat = archived.find((c) => c.id === id);
    setArchived((p) => p.filter((c) => c.id !== id));
    if (chat) setConvos((p) => [{ ...chat, is_archived: false }, ...p]);
    fetch(`/api/conversations/${id}/archive`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: false }) }).catch(() => {});
  }

  // Star message — instant toggle
  async function starMsg(id: string, v: boolean) {
    pausePoll();
    setMsgs((p) => p.map((m) => m.id === id ? { ...m, is_starred: v } : m)); setMsgMenuId(null);
    fetch(`/api/messages/${id}/star`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starred: v }) }).catch(() => {});
  }

  // React — instant emoji
  async function reactMsg(msgId: string, emoji: string) {
    if (!selId) return;
    pausePoll();
    const m = msgs.find((x) => x.id === msgId);
    const newEmoji = m?.reaction === emoji ? "" : emoji;
    setMsgs((p) => p.map((x) => x.id === msgId ? { ...x, reaction: newEmoji || null } : x)); setReactPickerId(null);
    fetch(`/api/conversations/${selId}/react`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: msgId, emoji: newEmoji, whatsappMsgId: m?.whatsapp_msg_id || null }) }).catch(() => {});
  }

  // Label actions — instant
  async function createLabel() {
    if (!newLabelName.trim()) return;
    pausePoll();
    const tempLabel = { id: `temp_${Date.now()}`, name: newLabelName.trim(), color: newLabelColor };
    setLabels((p) => [...p, tempLabel]);
    setNewLabelName("");
    fetch("/api/labels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: tempLabel.name, color: tempLabel.color }) }).then(() => fetchLabels()).catch(() => {});
  }
  async function deleteLabel(id: string) {
    if (!confirm("Delete this label?")) return;
    pausePoll();
    setLabels((p) => p.filter((l) => l.id !== id));
    fetch(`/api/labels/${id}`, { method: "DELETE" }).then(() => { fetchLabels(); fetchConvos(); }).catch(() => {});
  }
  async function toggleLabel(convoId: string, labelId: string, has: boolean) {
    pausePoll();
    const label = labels.find((l) => l.id === labelId);
    if (label) {
      setConvos((p) => p.map((c) => {
        if (c.id !== convoId) return c;
        const newLabels = has ? c.labels.filter((l) => l.id !== labelId) : [...c.labels, label];
        return { ...c, labels: newLabels };
      }));
    }
    setShowLabelMenu(null);
    fetch(`/api/conversations/${convoId}/labels`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label_id: labelId, action: has ? "remove" : "add" }) }).catch(() => {});
  }

  // Forward — show sending state
  async function forwardMessage(msgId: string, targetIds: string[]) {
    if (targetIds.length === 0) return;
    await fetch(`/api/messages/${msgId}/forward`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetConversationIds: targetIds }) });
    setForwardMsg(null);
    setForwardSelected(new Set());
    fetchConvos();
  }

  // Save contact as vCard
  function saveContact(convoId: string) {
    window.open(`/api/conversations/${convoId}/save-contact`, "_blank");
  }

  // Download all contacts as CSV (admin)
  function downloadContactsCsv() {
    window.open("/api/contacts/export", "_blank");
  }

  // Helper for optimistic messages
  function addOptimisticMsg(tempId: string, content: string, type: string = "text") {
    if (!selId) return;
    const msg: Message = {
      id: tempId, conversation_id: selId, role: "assistant", content,
      message_type: type as Message["message_type"], media_url: null, media_mime_type: null, media_filename: null,
      media_caption: null, media_sha256: null, reply_to_id: null,
      reaction: null, reaction_msg_id: null, latitude: null, longitude: null,
      location_name: null, location_address: null, whatsapp_msg_id: null,
      is_deleted: false, is_starred: false, status: "sent",
      created_at: new Date().toISOString(),
    };
    setMsgs((p) => [...p, msg]);
    setIsAtBottom(true);
  }

  // Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setReplyTo(null); setChatMenuId(null); setMsgMenuId(null); setReactPickerId(null); setShowEmoji(false); setHeaderMenu(false); setImgPreview(null); setShowChatSearch(false); setChatLabelOpen(null); setShowLabelMenu(null); setForwardMsg(null); setForwardSelected(new Set()); } };
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h);
  }, []);

  // Helpers
  function ft(d: string) { const t = new Date(d), n = new Date(), df = n.getTime() - t.getTime(); if (df < 86400000 && t.getDate() === n.getDate()) return t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); if (df < 172800000) return "Yesterday"; if (df < 604800000) return t.toLocaleDateString([], { weekday: "short" }); return t.toLocaleDateString([], { month: "short", day: "numeric" }); }
  function mt(d: string) { return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  function ini(n: string | null, p: string) { if (n) { const s = n.trim().split(/\s+/); return s.length >= 2 ? (s[0][0] + s[1][0]).toUpperCase() : n.slice(0, 2).toUpperCase(); } return p.slice(-2); }
  function aclr(id: string) { const c = ["from-emerald-500 to-teal-700","from-blue-500 to-indigo-700","from-purple-500 to-violet-700","from-orange-500 to-red-700","from-pink-500 to-rose-700","from-cyan-500 to-blue-700","from-amber-500 to-orange-700","from-lime-500 to-green-700"]; let h = 0; for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h); return c[Math.abs(h) % c.length]; }
  function lmp(c: ConversationWithLastMessage) { const p = c.last_message_role === "assistant" ? "✓ " : ""; const ic: Partial<Record<MessageType, string>> = { image: "📷 Photo", video: "🎥 Video", audio: "🎵 Audio", document: "📄 Document", sticker: "🏷️ Sticker", location: "📍 Location", contacts: "📇 Contact" }; if (c.last_message_type && c.last_message_type !== "text" && ic[c.last_message_type]) return p + ic[c.last_message_type]; return p + (c.last_message || ""); }
  function si(s: string) {
    if (s === "sent") return <span className="material-symbols-rounded inline ml-1 text-white/40" style={{ fontSize: 14 }}>check</span>;
    if (s === "delivered") return <span className="material-symbols-rounded inline ml-1 text-white/40" style={{ fontSize: 14 }}>done_all</span>;
    if (s === "read") return <span className="material-symbols-rounded inline ml-1 text-[#53bdeb]" style={{ fontSize: 14 }}>done_all</span>;
    return null;
  }
  function dl(d: string) { const t = new Date(d), n = new Date(); if (t.toDateString() === n.toDateString()) return "Today"; const y = new Date(n); y.setDate(y.getDate()-1); if (t.toDateString() === y.toDateString()) return "Yesterday"; return t.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }
  function sd(m: Message[], i: number) { return i === 0 || new Date(m[i].created_at).toDateString() !== new Date(m[i-1].created_at).toDateString(); }

  const filtered = convos.filter((c) => {
    // Search filter
    if (search) { const q = search.toLowerCase(); if (!(c.name?.toLowerCase().includes(q) || c.phone.includes(q) || c.last_message?.toLowerCase().includes(q))) return false; }
    // Tab filter
    if (filter === "unread") return c.unread_count > 0;
    if (filter !== "all") return c.labels?.some((l: Label) => l.id === filter); // label_id filter
    return true;
  });

  // Filter messages by chat search
  const displayMsgs = chatSearch ? msgs.filter((m) => m.content?.toLowerCase().includes(chatSearch.toLowerCase())) : msgs;

  // Media renderer
  function media(msg: Message) {
    if (msg.is_deleted) return <p className="italic text-white/40 text-[13px]">🚫 This message was deleted</p>;
    switch (msg.message_type) {
      case "image": return (<div>{msg.media_url && <img src={msg.media_url} alt="Photo" className="rounded-md max-w-[260px] max-h-[300px] object-cover cursor-pointer hover:brightness-90 transition" onClick={() => setImgPreview(msg.media_url)}/>}{msg.media_caption && msg.media_caption !== "[image]" && <p className="text-[13px] mt-1.5 whitespace-pre-wrap select-text cursor-text">{msg.media_caption}</p>}</div>);
      case "video": return (<div>{msg.media_url ? <video controls className="rounded-md max-w-[260px]" preload="metadata"><source src={msg.media_url} type={msg.media_mime_type || "video/mp4"}/></video> : <span className="text-[13px]">🎥 Video</span>}{msg.media_caption && <p className="text-[13px] mt-1.5 select-text cursor-text">{msg.media_caption}</p>}</div>);
      case "audio": return msg.media_url ? <audio controls className="max-w-[240px]" preload="metadata"><source src={msg.media_url} type={msg.media_mime_type || "audio/ogg"}/></audio> : <div className="flex items-center gap-2 text-[13px] text-white/60"><div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"/><span>Sending voice...</span></div>;
      case "document": return (<a href={msg.media_url || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 bg-white/[0.06] hover:bg-white/[0.10] transition rounded-lg p-3 min-w-[200px]"><div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-xl"><span className="material-symbols-rounded text-white/70" style={{ fontSize: 22 }}>description</span></div><div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate text-white">{msg.media_filename || "Document"}</p><p className="text-[11px] text-white/40 mt-0.5">{msg.media_mime_type || "File"} • Tap to open</p></div><span className="material-symbols-rounded text-white/50 flex-shrink-0" style={{ fontSize: 18 }}>open_in_new</span></a>);
      case "sticker": return msg.media_url ? <img src={msg.media_url} alt="" className="w-[120px] h-[120px] object-contain"/> : <span className="text-4xl">🏷️</span>;
      case "location": return (<a href={`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`} target="_blank" rel="noreferrer" className="block bg-white/[0.06] hover:bg-white/[0.10] transition rounded-lg p-3 min-w-[180px]"><p className="text-[13px] font-medium">📍 {msg.location_name || "Location"}</p>{msg.location_address && <p className="text-[11px] text-white/40 mt-0.5">{msg.location_address}</p>}<p className="text-[11px] text-emerald-400 mt-1">Open in Maps →</p></a>);
      default: return <p className="text-[13px] whitespace-pre-wrap break-words leading-[1.45] select-text cursor-text">{msg.content}</p>;
    }
  }

  // Chat menu dropdown
  function ChatMenu({ convo, onClose }: { convo: ConversationWithLastMessage; onClose: () => void }) {
    const labelsOpen = chatLabelOpen === convo.id;
    return (
      <div className="absolute right-2 top-full mt-1 z-[100] bg-[#233138] rounded-xl shadow-2xl py-1.5 min-w-[190px] border border-white/[0.1]" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        <MI i="push_pin" l={convo.is_pinned ? "Unpin chat" : "Pin chat"} o={() => { act(`/api/conversations/${convo.id}/pin`, { pinned: !convo.is_pinned }); onClose(); }}/>
        <MI i={convo.is_muted ? "notifications_active" : "notifications_off"} l={convo.is_muted ? "Unmute" : "Mute"} o={() => { act(`/api/conversations/${convo.id}/mute`, { muted: !convo.is_muted }); onClose(); }}/>
        <MI i="mark_email_unread" l="Mark as unread" o={() => { act(`/api/conversations/${convo.id}/unread`, { unread_count: 1 }); onClose(); }}/>
        <MI i="contact_page" l="Save contact" o={() => { saveContact(convo.id); onClose(); }}/>
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setChatLabelOpen(labelsOpen ? null : convo.id); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white/85 hover:bg-white/[0.06]">
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>label</span><span>Labels</span>
          <span className={`material-symbols-rounded transition-transform ${labelsOpen ? "rotate-180" : ""}`} style={{ fontSize: 14, marginLeft: "auto" }}>expand_more</span>
        </button>
        {labelsOpen && (
          <div className="px-2 py-1.5 border-t border-white/[0.06]" onClick={(e) => e.stopPropagation()}>
            {labels.map((l) => {
              const has = convo.labels?.some((cl: Label) => cl.id === l.id);
              return (
                <button key={l.id} onClick={(e) => { e.stopPropagation(); toggleLabel(convo.id, l.id, !!has); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] text-[12px]">
                  <span className="w-3 h-3 rounded-full flex-shrink-0 border-2" style={{ background: has ? l.color : "transparent", borderColor: l.color }}/>
                  <span className={has ? "text-white" : "text-white/50"}>{l.name}</span>
                </button>
              );
            })}
            {labels.length === 0 && <p className="text-[11px] text-white/30 px-2 py-1">No labels yet</p>}
          </div>
        )}
        <MI i="archive" l="Archive" o={() => { act(`/api/conversations/${convo.id}/archive`, { archived: true }); onClose(); }}/>
        {user?.role === "admin" && <>
          <div className="h-px bg-white/[0.06] my-1"/>
          <MI i="delete" l="Delete chat" o={() => { delChat(convo.id); onClose(); }} d/>
        </>}
      </div>
    );
  }

  if (authLoading) return (
    <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full"/>
    </div>
  );

  if (!user) {
    window.location.href = "/login";
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <p className="text-white/30 text-sm">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0f1419] overflow-hidden select-none" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ═══ SIDEBAR ═══ */}
      <div className="w-[340px] flex flex-col border-r border-white/[0.06] flex-shrink-0" style={{ background: "#141c24" }}>
        <div className="px-4 pt-3.5 pb-2.5 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                <span className="material-symbols-rounded text-white" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>chat</span>
              </div>
              <div><h1 className="text-[14px] font-semibold text-white tracking-tight">Whatt Dash</h1><p className="text-[11px] text-white/35 font-medium">{user.display_name} • {convos.length} chat{convos.length !== 1 ? "s" : ""}</p></div>
            </div>
            <div className="flex items-center gap-0.5">
              {user?.role === "admin" && (
                <button onClick={() => router.push("/admin")} className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors" title="Manage Users">
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>group</span>
                </button>
              )}
              <button onClick={() => setShowSearch(!showSearch)} className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"><span className="material-symbols-rounded" style={{ fontSize: 18 }}>search</span></button>
              {user?.role === "admin" && (
                <button onClick={downloadContactsCsv} className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors" title="Download Contacts CSV">
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>download</span>
                </button>
              )}
              <button onClick={signOut} className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-red-400 transition-colors" title="Sign Out">
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>logout</span>
              </button>
            </div>
          </div>
          {showSearch && <div className="relative mt-2.5"><span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-white/30" style={{ fontSize: 16 }}>search</span><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats..." className="w-full bg-white/[0.05] rounded-xl pl-9 pr-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:outline-none border border-white/[0.06] focus:border-emerald-500/30 transition-colors" autoFocus/></div>}
        </div>

        {/* Filter Tabs */}
        <div className="px-3 py-2 border-b border-white/[0.06] flex gap-1.5 overflow-x-auto">
          <button onClick={() => setFilter("all")} className={`px-3 py-1 rounded-full text-[11px] font-medium flex-shrink-0 transition-colors ${filter === "all" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.04] text-white/40 hover:text-white/60"}`}>All</button>
          <button onClick={() => setFilter("unread")} className={`px-3 py-1 rounded-full text-[11px] font-medium flex-shrink-0 transition-colors ${filter === "unread" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.04] text-white/40 hover:text-white/60"}`}>Unread</button>
          {labels.map((l) => (
            <button key={l.id} onClick={() => setFilter(filter === l.id ? "all" : l.id)} className={`px-3 py-1 rounded-full text-[11px] font-medium flex-shrink-0 transition-colors flex items-center gap-1.5 ${filter === l.id ? "bg-white/[0.08] text-white/80" : "bg-white/[0.04] text-white/40 hover:text-white/60"}`}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }}/>
              {l.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <div className="flex flex-col items-center justify-center h-48 text-white/25 text-xs">{search ? "No results" : "No conversations yet"}</div>}
          {filtered.map((c) => {
            const isSel = selId === c.id;
            return (
              <div key={c.id} className={`relative ${isSel ? "bg-[#202d3a]" : "hover:bg-white/[0.03]"}`}>
                <div className="flex items-center px-3 py-3 cursor-pointer" onClick={() => { setSelId(c.id); setChatMenuId(null); }}>
                  <div className={`w-[48px] h-[48px] rounded-xl bg-gradient-to-br ${aclr(c.id)} flex items-center justify-center flex-shrink-0 text-white text-[14px] font-bold`}>{ini(c.name, c.phone)}</div>
                  <div className="flex-1 min-w-0 ml-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-[14px] truncate ${c.unread_count > 0 ? "font-bold text-white" : "font-medium text-white/80"}`}>{c.name || c.phone}</span>
                      <span className={`text-[11px] flex-shrink-0 ml-2 ${c.unread_count > 0 ? "text-emerald-400" : "text-white/30"}`}>{ft(c.last_message_time || c.updated_at)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <p className={`text-[12px] truncate ${c.unread_count > 0 ? "text-white/60" : "text-white/35"}`}>{lmp(c)}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {c.labels?.map((l: Label) => <span key={l.id} className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }} title={l.name}/>)}
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
                      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>more_vert</span>
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
              <button onClick={async () => { setShowArchived(!showArchived); if (!showArchived) { try { const r = await fetch("/api/conversations/archived"); const d = await r.json(); if (Array.isArray(d)) setArchived(d); } catch {} } }} className="w-full flex items-center gap-3 px-4 py-3 text-white/50 hover:bg-white/[0.03]">
                <span>📦</span>
                <span className="text-[13px] font-medium">Archived ({archived.length})</span>
                <span className={`material-symbols-rounded transition-transform ${showArchived ? "rotate-180" : ""}`} style={{ fontSize: 16, marginLeft: "auto" }}>expand_more</span>
              </button>
              {showArchived && archived.map((ac) => (
                <div key={ac.id} className="flex items-center px-3 py-2.5 hover:bg-white/[0.03]">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${aclr(ac.id)} flex items-center justify-center flex-shrink-0 text-white text-[12px] font-bold opacity-60`}>{ini(ac.name, ac.phone)}</div>
                  <div className="flex-1 min-w-0 ml-3 cursor-pointer" onClick={() => setSelId(ac.id)}>
                    <span className="text-[13px] text-white/50 truncate block">{ac.name || ac.phone}</span>
                    <p className="text-[11px] text-white/30 truncate">{lmp(ac)}</p>
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <button onClick={() => unarchive(ac.id)} className="px-2 py-1 text-[10px] bg-emerald-600/20 text-emerald-400 rounded hover:bg-emerald-600/30 font-medium">Unarchive</button>
                    {user?.role === "admin" && <button onClick={() => delChat(ac.id)} className="px-2 py-1 text-[10px] bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 font-medium">Delete</button>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ LABELS MANAGEMENT ═══ */}
          <div className="border-t border-white/[0.06]">
            <div className="px-4 py-2.5">
              <p className="text-[11px] text-white/30 font-medium mb-2">MANAGE LABELS</p>
              <div className="flex gap-1.5 mb-2">
                <input type="text" value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)} placeholder="New label..." onKeyDown={(e) => e.key === "Enter" && createLabel()} className="flex-1 bg-[#202d3a] rounded px-2.5 py-1.5 text-[12px] text-white placeholder:text-white/25 focus:outline-none border border-white/[0.06] min-w-0"/>
                <input type="color" value={newLabelColor} onChange={(e) => setNewLabelColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0"/>
                <button onClick={createLabel} disabled={!newLabelName.trim()} className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 rounded text-[11px] text-white font-medium flex-shrink-0">+</button>
              </div>
              {labels.map((l) => (
                <div key={l.id} className="flex items-center gap-2 py-1 group/label">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: l.color }}/>
                  <span className="text-[12px] text-white/60 flex-1">{l.name}</span>
                  {user?.role === "admin" && <button onClick={() => deleteLabel(l.id)} className="text-[10px] text-red-400/0 group-hover/label:text-red-400/70 hover:!text-red-400 transition-colors">✕</button>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CHAT ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {!sel ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: "radial-gradient(ellipse at center, rgba(52,211,153,0.03) 0%, #0f1419 70%)" }}>
            <div className="w-20 h-20 rounded-3xl bg-white/[0.03] flex items-center justify-center border border-white/[0.06]"><span className="material-symbols-rounded text-white/12" style={{ fontSize: 36 }}>chat_bubble</span></div>
            <p className="text-[14px] text-white/20 font-medium">Select a chat</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between" style={{ background: "#1a2530" }}>
              <div className="flex items-center gap-3 cursor-pointer">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${aclr(sel.id)} flex items-center justify-center text-white text-sm font-bold`}>{ini(sel.name, sel.phone)}</div>
                <div><h2 className="text-[14px] font-semibold text-white tracking-tight">{sel.name || sel.phone}</h2><p className="text-[11px] text-white/40 font-mono">{sel.phone}</p></div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setShowChatSearch(!showChatSearch); setChatSearch(""); }} className="w-9 h-9 rounded-lg hover:bg-white/[0.08] flex items-center justify-center text-white/40 transition-colors"><span className="material-symbols-rounded" style={{ fontSize: 20 }}>search</span></button>
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setHeaderMenu(!headerMenu); setChatMenuId(null); setMsgMenuId(null); }} className="w-9 h-9 rounded-lg hover:bg-white/[0.08] flex items-center justify-center text-white/40 transition-colors">
                    <span className="material-symbols-rounded" style={{ fontSize: 20 }}>more_vert</span>
                  </button>
                  {headerMenu && (
                    <div className="absolute right-0 top-full mt-1 z-[100] bg-[#1e2d3a] rounded-2xl elevation-3 py-2 min-w-[200px] border border-white/[0.08] animate-scale-in" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                      <MI i="push_pin" l={sel.is_pinned ? "Unpin chat" : "Pin chat"} o={() => act(`/api/conversations/${sel.id}/pin`, { pinned: !sel.is_pinned })}/>
                      <MI i={sel.is_muted ? "notifications_active" : "notifications_off"} l={sel.is_muted ? "Unmute" : "Mute"} o={() => act(`/api/conversations/${sel.id}/mute`, { muted: !sel.is_muted })}/>
                      <MI i="mark_email_unread" l="Mark as unread" o={() => act(`/api/conversations/${sel.id}/unread`, { unread_count: 1 })}/>
                      <MI i="contact_page" l="Save contact" o={() => { saveContact(sel.id); setHeaderMenu(false); }}/>
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLabelMenu(showLabelMenu === sel.id ? null : sel.id); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white/85 hover:bg-white/[0.06]">
                        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>label</span><span>Labels</span>
                        <span className={`material-symbols-rounded transition-transform ${showLabelMenu === sel.id ? "rotate-180" : ""}`} style={{ fontSize: 14, marginLeft: "auto" }}>expand_more</span>
                      </button>
                      {showLabelMenu === sel.id && (
                        <div className="px-2 py-1.5 border-t border-white/[0.06]" onClick={(e) => e.stopPropagation()}>
                          {labels.map((l) => {
                            const has = sel.labels?.some((cl: Label) => cl.id === l.id);
                            return (
                              <button key={l.id} onClick={(e) => { e.stopPropagation(); toggleLabel(sel.id, l.id, !!has); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] text-[12px]">
                                <span className="w-3 h-3 rounded-full flex-shrink-0 border-2" style={{ background: has ? l.color : "transparent", borderColor: l.color }}/>
                                <span className={has ? "text-white" : "text-white/50"}>{l.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <MI i="archive" l="Archive" o={() => { act(`/api/conversations/${sel.id}/archive`, { archived: true }); if (selId === sel.id) { setSelId(null); setMsgs([]); } }}/>
                      {user?.role === "admin" && <>
                        <div className="h-px bg-white/[0.06] my-1"/>
                        <MI i="delete" l="Delete chat" o={() => delChat(sel.id)} d/>
                      </>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chat search bar */}
            {showChatSearch && (
              <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2" style={{ background: "#162028" }}>
                <span className="material-symbols-rounded text-white/30" style={{ fontSize: 16 }}>search</span>
                <input type="text" value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} placeholder="Search in chat..." className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/25 focus:outline-none" autoFocus/>
                <button onClick={() => { setShowChatSearch(false); setChatSearch(""); }} className="text-white/30 hover:text-white/60 text-sm">✕</button>
              </div>
            )}

            {/* Messages */}
            <div ref={chatBoxRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 sm:px-16 py-3 relative" style={{ backgroundColor: "#0f1419" }}>
              {displayMsgs.map((msg, i) => {
                const isMe = msg.role === "assistant";
                const replied = msg.reply_to_id ? msgs.find((m) => m.id === msg.reply_to_id) : null;
                return (
                  <div key={msg.id}>
                    {sd(displayMsgs, i) && <div className="flex justify-center my-3"><span className="px-3 py-1 rounded-md bg-[#162230] text-[11px] text-white/50 shadow">{dl(msg.created_at)}</span></div>}
                    <div className={`flex ${isMe ? "justify-end" : "justify-start"} ${msg.reaction ? "mb-4" : "mb-[2px]"} group/m`}>
                      <div className={`relative max-w-[65%]`}>
                        {replied && <div className={`px-2.5 py-1.5 rounded-t-lg text-[11px] border-l-[3px] ${isMe ? "bg-[#025144] border-emerald-300/50" : "bg-[#1d282f] border-purple-400/50"}`}><p className="font-semibold text-[10px] text-emerald-300 mb-0.5">{replied.role === "user" ? (sel?.name || sel?.phone) : "You"}</p><p className="truncate text-white/50">{replied.content}</p></div>}

                        <div className={`relative px-2.5 py-1.5 ${msg.message_type === "sticker" ? "bg-transparent" : isMe ? "bg-[#0d3b30] rounded-2xl rounded-tr-md" : "bg-[#1e2d3a] rounded-2xl rounded-tl-md"} ${replied ? "rounded-t-none" : ""}`}>
                          {/* Menu button on hover — WhatsApp style */}
                          {!msg.is_deleted && <div className={`absolute right-0 top-0 opacity-0 group-hover/m:opacity-100 z-10`}>
                            <button onClick={(e) => { e.stopPropagation(); setMsgMenuId(msgMenuId === msg.id ? null : msg.id); setChatMenuId(null); setHeaderMenu(false); }}
                              className={`w-7 h-7 rounded-bl-lg flex items-center justify-center ${isMe ? "bg-[#0d3b30] hover:bg-[#0f4538]" : "bg-[#1e2d3a] hover:bg-[#253540]"}`}>
                              <span className="material-symbols-rounded text-white/60" style={{ fontSize: 16 }}>expand_more</span>
                            </button>
                          </div>}

                          {media(msg)}
                          <div className="flex items-center justify-end gap-0.5 mt-0.5">
                            {msg.is_starred && <span className="text-[9px]">⭐</span>}
                            <span className="text-[10px] text-white/30">{mt(msg.created_at)}</span>
                            {isMe && si(msg.status || "sent")}
                          </div>
                        </div>

                        {msg.reaction && <div className={`absolute -bottom-2.5 ${isMe ? "right-2" : "left-2"} bg-[#162230] border border-white/[0.08] rounded-full px-1.5 py-0.5 text-[12px] shadow cursor-pointer hover:scale-110 transition group/react`} onClick={(e) => { e.stopPropagation(); reactMsg(msg.id, msg.reaction!); }} title="Click to remove">{msg.reaction}<span className="hidden group-hover/react:inline text-[9px] ml-0.5 text-white/30">✕</span></div>}

                        {/* Msg menu */}
                        {msgMenuId === msg.id && (() => {
                          const isNearBottom = i >= displayMsgs.length - 3;
                          return (
                          <div className={`absolute ${isMe ? "right-0" : "left-0"} ${isNearBottom ? "bottom-8" : "top-8"} z-[100] bg-[#1e2d3a] rounded-2xl elevation-3 py-1.5 min-w-[180px] border border-white/[0.08] animate-scale-in`} onClick={(e) => e.stopPropagation()}>
                            <MI i="reply" l="Reply" o={() => { setReplyTo(msg); setMsgMenuId(null); inputRef.current?.focus(); }}/>
                            <MI i="add_reaction" l="React" o={() => { setReactPickerId(msg.id); setMsgMenuId(null); }}/>
                            <MI i={msg.is_starred ? "star" : "star_outline"} l={msg.is_starred ? "Unstar" : "Star"} o={() => starMsg(msg.id, !msg.is_starred)}/>
                            <MI i="content_copy" l="Copy" o={() => { navigator.clipboard.writeText(msg.content); setMsgMenuId(null); }}/>
                            <MI i="forward" l="Forward" o={() => { setForwardMsg(msg); setForwardSelected(new Set()); setMsgMenuId(null); }}/>
                          </div>
                          );
                        })()}

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
                <button onClick={scrollToBottom} className="absolute right-6 -top-14 w-10 h-10 rounded-full bg-[#1e2d3a] border border-white/[0.1] shadow-lg flex items-center justify-center hover:bg-[#202d3a] transition-colors z-20">
                  {hasNewMsg && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">!</span>}
                  <span className="material-symbols-rounded text-white" style={{ fontSize: 18 }}>expand_more</span>
                </button>
              </div>
            )}

            {/* Reply */}
            {replyTo && (
              <div className="px-4 sm:px-16 pt-2" style={{ background: "#162028" }}>
                <div className="flex items-center gap-3 bg-[#141c24] border-l-[3px] border-emerald-500 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-emerald-400">{replyTo.role === "user" ? (sel?.name || sel?.phone) : "You"}</p><p className="text-[12px] text-white/50 truncate">{replyTo.content}</p></div>
                  <button onClick={() => setReplyTo(null)} className="text-white/30 hover:text-white/60 text-lg">✕</button>
                </div>
              </div>
            )}

            {/* Emoji */}
            {showEmoji && (
              <div className="mx-4 sm:mx-16 mb-1 bg-[#162230] rounded-xl border border-white/[0.08] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()} style={{ maxHeight: 280 }}>
                <div className="flex border-b border-white/[0.06] px-2 py-1.5 gap-1">
                  {Object.keys(EMOJIS).map((c) => <button key={c} onClick={() => setEmojiCat(c)} className={`text-[18px] w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${emojiCat === c ? "bg-emerald-500/20" : "hover:bg-white/[0.06]"}`}>{c}</button>)}
                </div>
                <div className="p-2 overflow-y-auto" style={{ maxHeight: 200 }}>
                  <div className="flex flex-wrap gap-0.5">{EMOJIS[emojiCat]?.map((em, i) => <button key={i} onClick={() => { setInput((p) => p + em); setShowEmoji(false); inputRef.current?.focus(); }} className="w-9 h-9 text-[20px] rounded-lg hover:bg-white/[0.08] flex items-center justify-center">{em}</button>)}</div>
                </div>
              </div>
            )}

            {/* Quick Replies Panel */}
            {showQuickReplies && (
              <div className="mx-4 sm:mx-16 mb-1 bg-[#162230] rounded-xl border border-white/[0.08] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()} style={{ maxHeight: 360 }}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
                  <span className="text-[13px] font-semibold text-white/80">⚡ Quick Replies</span>
                  <div className="flex gap-1">
                    {qrMode === "list" && <button onClick={() => { setQrMode("add"); setQrTitle(""); setQrContent(""); setQrCategory(""); }} className="text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-md">+ New</button>}
                    {qrMode !== "list" && <button onClick={() => { setQrMode("list"); setQrEditId(null); }} className="text-[11px] text-white/50 hover:text-white/80 px-2 py-1">← Back</button>}
                    <button onClick={() => setShowQuickReplies(false)} className="text-white/30 hover:text-white/60 text-lg leading-none">✕</button>
                  </div>
                </div>
                {qrMode === "list" && (
                  <>
                    <div className="px-3 py-2 border-b border-white/[0.06]">
                      <input type="text" value={qrSearch} onChange={(e) => setQrSearch(e.target.value)} placeholder="Search replies..." className="w-full bg-white/[0.05] rounded-md px-3 py-1.5 text-[12px] text-white placeholder:text-white/25 focus:outline-none border border-white/[0.06]"/>
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                      {quickReplies.filter((qr) => !qrSearch || qr.title.toLowerCase().includes(qrSearch.toLowerCase()) || qr.content.toLowerCase().includes(qrSearch.toLowerCase())).length === 0 ? (
                        <div className="px-4 py-8 text-center text-[13px] text-white/30">{quickReplies.length === 0 ? "No quick replies yet. Click + New to create one." : "No matches found."}</div>
                      ) : (
                        quickReplies.filter((qr) => !qrSearch || qr.title.toLowerCase().includes(qrSearch.toLowerCase()) || qr.content.toLowerCase().includes(qrSearch.toLowerCase())).map((qr) => (
                          <div key={qr.id} className="flex items-start gap-2 px-3 py-2.5 hover:bg-white/[0.04] group cursor-pointer border-b border-white/[0.03]" onClick={() => useQuickReply(qr)}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] font-semibold text-emerald-400 truncate">{qr.title}</span>
                                {qr.category && <span className="text-[10px] bg-white/[0.08] text-white/40 px-1.5 py-0.5 rounded">{qr.category}</span>}
                                <span className="text-[10px] text-white/20 ml-auto flex-shrink-0">used {qr.usage_count}x</span>
                              </div>
                              <p className="text-[12px] text-white/50 truncate mt-0.5">{qr.content}</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5">
                              <button onClick={(e) => { e.stopPropagation(); setQrMode("edit"); setQrEditId(qr.id); setQrTitle(qr.title); setQrContent(qr.content); setQrCategory(qr.category || ""); }} className="text-[10px] text-white/30 hover:text-white/60 p-1">✏️</button>
                              <button onClick={(e) => { e.stopPropagation(); deleteQuickReply(qr.id); }} className="text-[10px] text-white/30 hover:text-red-400 p-1">🗑️</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
                {(qrMode === "add" || qrMode === "edit") && (
                  <div className="px-3 py-3 space-y-2.5">
                    <input type="text" value={qrTitle} onChange={(e) => setQrTitle(e.target.value)} placeholder="Title (e.g. Greeting, Price, Delivery)" className="w-full bg-white/[0.05] rounded-md px-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:outline-none border border-white/[0.06]"/>
                    <textarea value={qrContent} onChange={(e) => setQrContent(e.target.value)} placeholder={"Message content...\nUse {name} for customer name\nUse {phone} for phone number"} rows={3} className="w-full bg-white/[0.05] rounded-md px-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:outline-none border border-white/[0.06] resize-none"/>
                    <input type="text" value={qrCategory} onChange={(e) => setQrCategory(e.target.value)} placeholder="Category (optional — e.g. Sales, Support)" className="w-full bg-white/[0.05] rounded-md px-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:outline-none border border-white/[0.06]"/>
                    <button onClick={qrMode === "edit" ? updateQuickReply : createQuickReply} disabled={!qrTitle.trim() || !qrContent.trim()} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-medium py-2 rounded-md text-[13px]">
                      {qrMode === "edit" ? "Update" : "Save"} Quick Reply
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Input */}
            <div className="px-4 sm:px-12 py-2.5 flex items-end gap-2" style={{ background: "#1a2530" }}>
              <button onClick={(e) => { e.stopPropagation(); setShowEmoji(!showEmoji); setShowQuickReplies(false); }} className="w-10 h-10 rounded-xl hover:bg-white/[0.08] flex items-center justify-center text-white/40 flex-shrink-0 transition-colors"><span className="material-symbols-rounded" style={{ fontSize: 22 }}>mood</span></button>
              <button onClick={(e) => { e.stopPropagation(); setShowQuickReplies(!showQuickReplies); setShowEmoji(false); setQrMode("list"); setQrSearch(""); }} className="w-10 h-10 rounded-xl hover:bg-white/[0.08] flex items-center justify-center text-white/40 flex-shrink-0 transition-colors" title="Quick Replies"><span className="material-symbols-rounded" style={{ fontSize: 22 }}>bolt</span></button>
              <button onClick={() => document.getElementById("file-input")?.click()} className="w-10 h-10 rounded-xl hover:bg-white/[0.08] flex items-center justify-center text-white/40 flex-shrink-0 transition-colors" title="Attach file">
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
                  const fd = new FormData();
                  fd.append("file", file);
                  fd.append("caption", "");
                  const res = await fetch(`/api/conversations/${selId}/send-media`, { method: "POST", body: fd });
                  if (!res.ok) { setMsgs((p) => p.filter((m) => m.id !== tempId)); const d = await res.json(); alert("Error: " + JSON.stringify(d)); setSending(false); }
                  else { const real = await res.json(); lastSentIdsRef.current.add(real.id); setMsgs((p) => p.map((m) => m.id === tempId ? { ...real } : m)); setTimeout(() => { setSending(false); setTimeout(() => lastSentIdsRef.current.delete(real.id), 10000); }, 3000); }
                } catch (err) { setMsgs((p) => p.filter((m) => m.id !== tempId)); alert("Error: " + String(err)); setSending(false); }
                finally { e.target.value = ""; }
              }}/>
              <div className="flex-1 bg-[#202d3a] rounded-2xl px-4 py-2.5 border border-white/[0.06] focus-within:border-emerald-500/30 transition-colors"><textarea ref={inputRef} value={input} onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Type a message" rows={1} className="w-full bg-transparent text-[14px] text-white placeholder:text-white/30 focus:outline-none resize-none leading-[1.4] max-h-[120px] overflow-y-auto" style={{ height: "auto" }}/></div>
              <button onClick={handleSend} disabled={sending || !input.trim()} className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 transition-all flex items-center justify-center flex-shrink-0">
                {sending ? <span className="material-symbols-rounded animate-spin text-white" style={{ fontSize: 20 }}>progress_activity</span>
                : <span className="material-symbols-rounded text-white" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>send</span>}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Image Preview */}
      {imgPreview && <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center" onClick={() => setImgPreview(null)}><button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl">✕</button><img src={imgPreview} alt="" className="max-w-[90vw] max-h-[90vh] object-contain" onClick={(e) => e.stopPropagation()}/></div>}

      {/* Forward Modal — multi-select */}
      {forwardMsg && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center" onClick={() => { setForwardMsg(null); setForwardSelected(new Set()); }}>
          <div className="bg-[#141c24] rounded-xl border border-white/[0.08] shadow-2xl w-[360px] max-h-[520px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-white">Forward to</h3>
              <button onClick={() => { setForwardMsg(null); setForwardSelected(new Set()); }} className="text-white/30 hover:text-white/60 text-lg">✕</button>
            </div>
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <div className="bg-[#1e2d3a] rounded-lg px-3 py-1.5 text-[12px] text-white/50 truncate">
                {forwardMsg.content?.substring(0, 100)}
              </div>
            </div>
            {forwardSelected.size > 0 && (
              <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2 flex-wrap">
                {Array.from(forwardSelected).map((id) => { const c = convos.find((x) => x.id === id); return c ? (
                  <span key={id} className="bg-emerald-500/20 text-emerald-400 text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    {c.name || c.phone}
                    <button onClick={() => { const s = new Set(forwardSelected); s.delete(id); setForwardSelected(s); }} className="hover:text-white">✕</button>
                  </span>
                ) : null; })}
              </div>
            )}
            <div className="overflow-y-auto max-h-[320px]">
              {convos.filter((c) => c.id !== forwardMsg.conversation_id).map((c) => {
                const isSelected = forwardSelected.has(c.id);
                return (
                  <button key={c.id} onClick={() => {
                    const s = new Set(forwardSelected);
                    if (isSelected) s.delete(c.id); else s.add(c.id);
                    setForwardSelected(s);
                  }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${isSelected ? "bg-emerald-500/10" : "hover:bg-white/[0.04]"}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-emerald-500 border-emerald-500" : "border-white/20"}`}>
                      {isSelected && <span className="material-symbols-rounded text-white" style={{ fontSize: 14 }}>check</span>}
                    </div>
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${aclr(c.id)} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0`}>{ini(c.name, c.phone)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white font-medium truncate">{c.name || c.phone}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {forwardSelected.size > 0 && (
              <div className="px-4 py-3 border-t border-white/[0.06] flex justify-end">
                <button onClick={() => forwardMessage(forwardMsg.id, Array.from(forwardSelected))} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-2 rounded-lg text-[13px] flex items-center gap-2">
                  <span className="material-symbols-rounded text-white" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>send</span>
                  Send ({forwardSelected.size})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click-away to close menus */}
      {(chatMenuId || msgMenuId || headerMenu || reactPickerId) && <div className="fixed inset-0 z-[90]" onClick={() => { setChatMenuId(null); setMsgMenuId(null); setHeaderMenu(false); setReactPickerId(null); setShowLabelMenu(null); setChatLabelOpen(null); setShowQuickReplies(false); }}/>}
    </div>
  );
}

function MI({ i, l, o, d }: { i: string; l: string; o: () => void; d?: boolean }) {
  return <button onClick={o} className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors ${d ? "text-red-400 hover:bg-red-500/10" : "text-white/85 hover:bg-white/[0.06]"}`}><span className="material-symbols-rounded" style={{ fontSize: 18, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>{i}</span><span>{l}</span></button>;
}
