"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import type { ConversationWithLastMessage, Message, MessageType } from "@/lib/types";

// ============================================================
// WHATT-DASH: Full WhatsApp Business Dashboard
// ============================================================

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function Dashboard() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
  }, []);

  // ─── State ─────────────────────────────────────────────────
  const [conversations, setConversations] = useState<ConversationWithLastMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: "chat" | "message"; id: string } | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId);

  // ─── Data Fetching ────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    const data = await res.json();
    if (Array.isArray(data)) setConversations(data);
  }, []);

  const fetchMessages = useCallback(async (convoId: string) => {
    const res = await fetch(`/api/conversations/${convoId}/messages`);
    const data = await res.json();
    if (Array.isArray(data)) setMessages(data);
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId);
      // Mark as read
      fetch(`/api/conversations/${selectedId}/read`, { method: "POST" });
      // Update local state immediately
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedId ? { ...c, unread_count: 0 } : c))
      );
    }
  }, [selectedId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Realtime ─────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("realtime-all")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.conversation_id === selectedId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
          // Browser notification for incoming messages
          if (newMsg.role === "user" && newMsg.conversation_id !== selectedId) {
            showNotification(newMsg);
          }
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => fetchConversations()
      )
      .subscribe();

    return () => { supabase?.removeChannel(channel); };
  }, [selectedId, fetchConversations, supabase]);

  // ─── Notifications ────────────────────────────────────────
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  function showNotification(msg: Message) {
    if ("Notification" in window && Notification.permission === "granted") {
      const convo = conversations.find((c) => c.id === msg.conversation_id);
      const title = convo?.name || convo?.phone || "New Message";
      new Notification(title, {
        body: msg.content.substring(0, 100),
        icon: "/favicon.ico",
        tag: msg.conversation_id,
      });
    }
  }

  // ─── Actions ──────────────────────────────────────────────
  async function handleSend() {
    if (!input.trim() || !selectedId || sending) return;
    setSending(true);

    try {
      const body: Record<string, string> = { message: input.trim() };
      if (replyTo) {
        body.replyToMsgId = replyTo.id;
        if (replyTo.whatsapp_msg_id) body.replyToWhatsappId = replyTo.whatsapp_msg_id;
      }

      const res = await fetch(`/api/conversations/${selectedId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        alert("Error: " + JSON.stringify(data, null, 2));
        setSending(false);
        return;
      }

      setInput("");
      setReplyTo(null);
      fetchMessages(selectedId);
    } catch (err) {
      alert("Network Error: " + String(err));
    } finally {
      setSending(false);
    }
  }

  async function handlePin(convoId: string, pinned: boolean) {
    await fetch(`/api/conversations/${convoId}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });
    fetchConversations();
    setContextMenu(null);
  }

  async function handleMute(convoId: string, muted: boolean) {
    await fetch(`/api/conversations/${convoId}/mute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ muted }),
    });
    fetchConversations();
    setContextMenu(null);
  }

  async function handleMarkUnread(convoId: string) {
    await fetch(`/api/conversations/${convoId}/unread`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unread_count: 1 }),
    });
    fetchConversations();
    setContextMenu(null);
  }

  async function handleArchive(convoId: string) {
    await fetch(`/api/conversations/${convoId}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    if (selectedId === convoId) setSelectedId(null);
    fetchConversations();
    setContextMenu(null);
  }

  async function handleDeleteChat(convoId: string) {
    if (!confirm("Delete this entire conversation? This cannot be undone.")) return;
    await fetch(`/api/conversations/${convoId}/delete`, { method: "POST" });
    if (selectedId === convoId) {
      setSelectedId(null);
      setMessages([]);
    }
    fetchConversations();
    setContextMenu(null);
  }

  async function handleDeleteMessage(msgId: string) {
    await fetch(`/api/messages/${msgId}/delete`, { method: "POST" });
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, is_deleted: true, content: "🚫 This message was deleted" } : m))
    );
    setContextMenu(null);
  }

  async function handleStarMessage(msgId: string, starred: boolean) {
    await fetch(`/api/messages/${msgId}/star`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred }),
    });
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, is_starred: starred } : m))
    );
    setContextMenu(null);
  }

  async function handleReact(msgId: string, emoji: string) {
    if (!selectedId) return;
    const msg = messages.find((m) => m.id === msgId);
    await fetch(`/api/conversations/${selectedId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId: msgId,
        emoji,
        whatsappMsgId: msg?.whatsapp_msg_id || null,
      }),
    });
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, reaction: emoji } : m))
    );
    setShowReactionPicker(null);
  }

  // ─── Close menus on outside click ─────────────────────────
  useEffect(() => {
    function handleClick() {
      setContextMenu(null);
      setShowReactionPicker(null);
      setShowEmojiPicker(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // ─── Keyboard shortcut ────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setReplyTo(null);
        setContextMenu(null);
        setShowReactionPicker(null);
        setShowEmojiPicker(false);
        setImagePreview(null);
      }
      // Ctrl+K for search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch((p) => !p);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ─── Helpers ──────────────────────────────────────────────
  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const dayMs = 86400000;

    if (diff < dayMs && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (diff < dayMs * 2) return "Yesterday";
    if (diff < dayMs * 7) {
      return d.toLocaleDateString([], { weekday: "short" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function formatMsgTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getInitials(name: string | null, phone: string) {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    return phone.slice(-2);
  }

  function getAvatarColor(id: string) {
    const colors = [
      "from-emerald-500 to-teal-700",
      "from-blue-500 to-indigo-700",
      "from-purple-500 to-violet-700",
      "from-orange-500 to-red-700",
      "from-pink-500 to-rose-700",
      "from-cyan-500 to-blue-700",
      "from-amber-500 to-orange-700",
      "from-lime-500 to-green-700",
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  function getLastMessagePreview(convo: ConversationWithLastMessage) {
    const prefix = convo.last_message_role === "assistant" ? "✓ You: " : "";
    const typeIcons: Partial<Record<MessageType, string>> = {
      image: "📷 Photo",
      video: "🎥 Video",
      audio: "🎵 Audio",
      document: "📄 Document",
      sticker: "🏷️ Sticker",
      location: "📍 Location",
      contacts: "📇 Contact",
    };
    if (convo.last_message_type && convo.last_message_type !== "text" && typeIcons[convo.last_message_type]) {
      return prefix + typeIcons[convo.last_message_type];
    }
    return prefix + (convo.last_message || "No messages yet");
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "sent":
        return (
          <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className="inline-block ml-1">
            <path d="M11 1L4.5 8.5L1 5.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "delivered":
        return (
          <svg width="20" height="11" viewBox="0 0 20 11" fill="none" className="inline-block ml-1">
            <path d="M7 1L1.5 7.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M14 1L7.5 8.5L5 6" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case "read":
        return (
          <svg width="20" height="11" viewBox="0 0 20 11" fill="none" className="inline-block ml-1">
            <path d="M7 1L1.5 7.5" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M14 1L7.5 8.5L5 6" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      default:
        return null;
    }
  }

  // ─── Filtered conversations ───────────────────────────────
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.name?.toLowerCase().includes(q)) ||
      c.phone.includes(q) ||
      (c.last_message?.toLowerCase().includes(q))
    );
  });

  // ─── Message date grouping ────────────────────────────────
  function getDateLabel(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const dayMs = 86400000;
    if (diff < dayMs && d.getDate() === now.getDate()) return "Today";
    if (diff < dayMs * 2 && d.getDate() === now.getDate() - 1) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  function shouldShowDateSeparator(msgs: Message[], idx: number) {
    if (idx === 0) return true;
    const curr = new Date(msgs[idx].created_at).toDateString();
    const prev = new Date(msgs[idx - 1].created_at).toDateString();
    return curr !== prev;
  }

  // ─── Render media in messages ─────────────────────────────
  function renderMessageContent(msg: Message) {
    if (msg.is_deleted) {
      return <p className="italic text-white/40 text-sm">🚫 This message was deleted</p>;
    }

    switch (msg.message_type) {
      case "image":
        return (
          <div>
            {msg.media_url && (
              <img
                src={msg.media_url}
                alt="Image"
                className="rounded-lg max-w-[280px] cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setImagePreview(msg.media_url)}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            {(msg.media_caption || msg.content) && msg.content !== "[image]" && (
              <p className="text-sm mt-2 whitespace-pre-wrap">{msg.media_caption || msg.content}</p>
            )}
          </div>
        );

      case "video":
        return (
          <div>
            {msg.media_url ? (
              <video controls className="rounded-lg max-w-[280px]" preload="metadata">
                <source src={msg.media_url} type={msg.media_mime_type || "video/mp4"} />
              </video>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span>🎥</span> <span>Video</span>
              </div>
            )}
            {msg.media_caption && <p className="text-sm mt-2 whitespace-pre-wrap">{msg.media_caption}</p>}
          </div>
        );

      case "audio":
        return (
          <div>
            {msg.media_url ? (
              <audio controls className="max-w-[250px]" preload="metadata">
                <source src={msg.media_url} type={msg.media_mime_type || "audio/ogg"} />
              </audio>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span>🎵</span> <span>Voice message</span>
              </div>
            )}
          </div>
        );

      case "document":
        return (
          <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3 min-w-[200px]">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/60">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{msg.media_filename || "Document"}</p>
              <p className="text-xs text-white/40 mt-0.5">{msg.media_mime_type || "File"}</p>
            </div>
            {msg.media_url && (
              <a href={msg.media_url} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </a>
            )}
          </div>
        );

      case "sticker":
        return (
          <div>
            {msg.media_url ? (
              <img src={msg.media_url} alt="Sticker" className="w-[128px] h-[128px] object-contain" />
            ) : (
              <span className="text-4xl">🏷️</span>
            )}
          </div>
        );

      case "location":
        return (
          <div className="min-w-[200px]">
            <a
              href={`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <div className="bg-white/5 rounded-lg overflow-hidden">
                <img
                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${msg.latitude},${msg.longitude}&zoom=15&size=280x150&markers=${msg.latitude},${msg.longitude}&key=`}
                  alt="Location"
                  className="w-full h-[100px] object-cover bg-white/10"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="p-2.5">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    📍 {msg.location_name || "Location"}
                  </p>
                  {msg.location_address && (
                    <p className="text-xs text-white/40 mt-0.5">{msg.location_address}</p>
                  )}
                </div>
              </div>
            </a>
          </div>
        );

      case "contacts":
        return (
          <div className="text-sm">
            <p>{msg.content}</p>
          </div>
        );

      default:
        return <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>;
    }
  }

  // ─── Find replied message ─────────────────────────────────
  function findRepliedMessage(replyToId: string | null) {
    if (!replyToId) return null;
    return messages.find((m) => m.id === replyToId);
  }

  // ─── Quick Emoji List ─────────────────────────────────────
  const quickEmojis = ["😀", "😂", "❤️", "🔥", "👍", "👎", "🎉", "💯", "🙏", "😎", "🤔", "😅", "😍", "🥲", "😤", "💪"];

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#0b0b0b] font-sans overflow-hidden select-none">

      {/* ════════════ SIDEBAR ════════════ */}
      <div
        className={`${showSidebar ? "w-[340px]" : "w-0 overflow-hidden"} flex flex-col border-r border-white/[0.06] transition-all duration-200`}
        style={{ background: "#111111" }}
      >
        {/* Sidebar Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.632.632l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.379 0-4.588-.813-6.334-2.176l-.442-.352-3.17 1.063 1.063-3.17-.352-.442A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                </svg>
              </div>
              <div>
                <h1 className="text-[13px] font-bold text-white tracking-tight">Whatt Dash</h1>
                <p className="text-[10px] text-white/35 font-medium">{conversations.length} conversation{conversations.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setShowSearch(!showSearch); }}
              className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
              title="Search (Ctrl+K)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>

          {/* Search */}
          {showSearch && (
            <div className="relative mt-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full bg-white/[0.05] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 border border-white/[0.06]"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filteredConversations.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 gap-2.5">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-xs text-white/25">{searchQuery ? "No results found" : "No conversations yet"}</p>
            </div>
          )}

          {filteredConversations.map((convo) => {
            const isSelected = selectedId === convo.id;
            return (
              <button
                key={convo.id}
                onClick={() => setSelectedId(convo.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, type: "chat", id: convo.id });
                }}
                className={`w-full text-left px-3 py-3 transition-all duration-100 relative group ${
                  isSelected ? "bg-emerald-500/10" : "hover:bg-white/[0.03]"
                }`}
              >
                {isSelected && (
                  <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-emerald-500 rounded-r-full" />
                )}
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`w-[46px] h-[46px] rounded-full bg-gradient-to-br ${getAvatarColor(convo.id)} flex items-center justify-center flex-shrink-0 text-white text-sm font-bold shadow-lg`}>
                    {getInitials(convo.name, convo.phone)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-[13px] font-semibold truncate ${convo.unread_count > 0 ? "text-white" : "text-white/80"}`}>
                          {convo.name || convo.phone}
                        </span>
                        {convo.is_muted && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" className="flex-shrink-0">
                            <line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.5-.35 2.19" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {convo.is_pinned && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.25)" className="flex-shrink-0">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                          </svg>
                        )}
                        <span className={`text-[10px] flex-shrink-0 ${convo.unread_count > 0 ? "text-emerald-400 font-semibold" : "text-white/30"}`}>
                          {formatTime(convo.last_message_time || convo.updated_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={`text-xs truncate ${convo.unread_count > 0 ? "text-white/60" : "text-white/35"}`}>
                        {getLastMessagePreview(convo)}
                      </p>
                      {convo.unread_count > 0 && (
                        <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                          {convo.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ════════════ CHAT PANEL ════════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center gap-5" style={{ background: "radial-gradient(ellipse at center, rgba(16,185,129,0.04) 0%, transparent 70%)" }}>
            <div className="w-20 h-20 rounded-3xl bg-white/[0.03] flex items-center justify-center border border-white/[0.06]">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-white/30">Whatt Dash</p>
              <p className="text-xs text-white/15 mt-1.5 max-w-[260px]">Select a conversation to view messages and reply</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between" style={{ background: "#111111" }}>
              <div className="flex items-center gap-3">
                {/* Mobile sidebar toggle */}
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors lg:hidden"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(selected.id)} flex items-center justify-center text-white text-sm font-bold`}>
                  {getInitials(selected.name, selected.phone)}
                </div>
                <div>
                  <h2 className="text-[13px] font-bold text-white leading-tight">{selected.name || selected.phone}</h2>
                  <p className="text-[11px] text-white/35 leading-tight mt-0.5 font-mono">{selected.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/70"
                  title="Search"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-1"
              style={{
                backgroundImage: `
                  url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.01'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"),
                  radial-gradient(ellipse at 20% 80%, rgba(16,185,129,0.02) 0%, transparent 50%)
                `,
                backgroundColor: "#0b0b0b",
              }}
            >
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const repliedMsg = findRepliedMessage(msg.reply_to_id);
                const showDate = shouldShowDateSeparator(messages, i);

                return (
                  <div key={msg.id}>
                    {/* Date Separator */}
                    {showDate && (
                      <div className="flex items-center justify-center my-4">
                        <span className="px-3 py-1 rounded-lg bg-white/[0.06] text-[11px] text-white/40 font-medium">
                          {getDateLabel(msg.created_at)}
                        </span>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`flex ${isUser ? "justify-start" : "justify-end"} group/msg mb-1`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, type: "message", id: msg.id });
                      }}
                    >
                      <div className={`relative flex flex-col ${isUser ? "items-start" : "items-end"} max-w-[70%] sm:max-w-[55%]`}>
                        {/* Reply Quote */}
                        {repliedMsg && (
                          <div className={`w-full px-3 py-2 mb-0.5 rounded-t-xl text-xs border-l-2 ${
                            isUser
                              ? "bg-white/[0.04] border-white/20 text-white/50"
                              : "bg-emerald-800/30 border-emerald-400/50 text-white/60"
                          }`}>
                            <p className="font-medium text-[10px] mb-0.5 text-white/40">
                              {repliedMsg.role === "user" ? (selected?.name || selected?.phone) : "You"}
                            </p>
                            <p className="truncate">{repliedMsg.content}</p>
                          </div>
                        )}

                        <div
                          className={`relative px-3 py-2 text-sm leading-relaxed ${
                            msg.message_type === "sticker"
                              ? "bg-transparent"
                              : isUser
                                ? "bg-[#1a1a2e] text-white/90 rounded-2xl rounded-tl-[4px] border border-white/[0.06]"
                                : "bg-emerald-700/80 text-white rounded-2xl rounded-tr-[4px]"
                          } ${repliedMsg ? "rounded-t-none" : ""}`}
                        >
                          {renderMessageContent(msg)}

                          {/* Time + Status */}
                          <div className={`flex items-center justify-end gap-0.5 mt-1 ${msg.message_type === "sticker" ? "bg-black/40 rounded-lg px-2 py-0.5 w-fit ml-auto" : ""}`}>
                            <span className="text-[10px] text-white/30">{formatMsgTime(msg.created_at)}</span>
                            {msg.is_starred && <span className="text-[10px] ml-0.5">⭐</span>}
                            {!isUser && getStatusIcon(msg.status || "sent")}
                          </div>
                        </div>

                        {/* Reaction badge */}
                        {msg.reaction && (
                          <div className={`absolute -bottom-2 ${isUser ? "left-2" : "right-2"} bg-[#1a1a1a] border border-white/[0.08] rounded-full px-1.5 py-0.5 text-xs shadow-lg cursor-pointer hover:scale-110 transition-transform`}
                            onClick={(e) => { e.stopPropagation(); setShowReactionPicker(msg.id); }}
                          >
                            {msg.reaction}
                          </div>
                        )}

                        {/* Hover Actions */}
                        <div className={`absolute top-0 ${isUser ? "-right-8" : "-left-8"} opacity-0 group-hover/msg:opacity-100 transition-opacity flex flex-col gap-0.5`}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowReactionPicker(msg.id); }}
                            className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/40 hover:text-white/70 transition-all text-xs"
                            title="React"
                          >
                            😀
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setReplyTo(msg); inputRef.current?.focus(); }}
                            className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/40 hover:text-white/70 transition-all"
                            title="Reply"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="9 17 4 12 9 7" />
                              <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                            </svg>
                          </button>
                        </div>

                        {/* Reaction Picker */}
                        {showReactionPicker === msg.id && (
                          <div
                            className={`absolute ${isUser ? "left-0" : "right-0"} -top-10 z-50 bg-[#1e1e1e] border border-white/[0.08] rounded-full px-2 py-1.5 flex gap-1 shadow-2xl`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleReact(msg.id, emoji)}
                                className="text-lg hover:scale-125 transition-transform px-0.5"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Banner */}
            {replyTo && (
              <div className="px-4 sm:px-6 pt-2 pb-0" style={{ background: "#111111" }}>
                <div className="flex items-center gap-3 bg-white/[0.04] border-l-3 border-emerald-500 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-emerald-400 mb-0.5">
                      Replying to {replyTo.role === "user" ? (selected?.name || selected?.phone) : "yourself"}
                    </p>
                    <p className="text-xs text-white/50 truncate">{replyTo.content}</p>
                  </div>
                  <button
                    onClick={() => setReplyTo(null)}
                    className="w-6 h-6 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-white/30 hover:text-white/60 flex-shrink-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Input Bar */}
            <div className="px-4 sm:px-6 py-3 border-t border-white/[0.06]" style={{ background: "#111111" }}>
              {/* Emoji Quick Pick */}
              {showEmojiPicker && (
                <div className="mb-2 bg-white/[0.04] rounded-xl p-2 border border-white/[0.06]" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-1">
                    {quickEmojis.map((e) => (
                      <button
                        key={e}
                        onClick={() => { setInput((p) => p + e); setShowEmojiPicker(false); inputRef.current?.focus(); }}
                        className="text-xl hover:scale-110 transition-transform w-9 h-9 rounded-lg hover:bg-white/[0.06] flex items-center justify-center"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }}
                  className="w-9 h-9 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" /><line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" />
                  </svg>
                </button>

                <div className="flex-1 flex items-center bg-white/[0.05] rounded-xl px-4 py-2.5 border border-white/[0.06] focus-within:border-emerald-500/30 transition-colors">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/20 focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                  aria-label="Send"
                >
                  {sending ? (
                    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ════════════ CONTEXT MENU ════════════ */}
      {contextMenu && (
        <div
          className="fixed z-[100] bg-[#1e1e1e] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 py-1.5 min-w-[180px] backdrop-blur-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "chat" ? (
            <>
              {(() => {
                const convo = conversations.find((c) => c.id === contextMenu.id);
                if (!convo) return null;
                return (
                  <>
                    <ContextMenuItem
                      icon={convo.is_pinned ? "📌" : "📌"}
                      label={convo.is_pinned ? "Unpin Chat" : "Pin Chat"}
                      onClick={() => handlePin(convo.id, !convo.is_pinned)}
                    />
                    <ContextMenuItem
                      icon={convo.is_muted ? "🔔" : "🔕"}
                      label={convo.is_muted ? "Unmute" : "Mute"}
                      onClick={() => handleMute(convo.id, !convo.is_muted)}
                    />
                    <ContextMenuItem
                      icon="📩"
                      label="Mark as Unread"
                      onClick={() => handleMarkUnread(convo.id)}
                    />
                    <ContextMenuItem
                      icon="📦"
                      label="Archive Chat"
                      onClick={() => handleArchive(convo.id)}
                    />
                    <div className="h-px bg-white/[0.06] my-1" />
                    <ContextMenuItem
                      icon="🗑️"
                      label="Delete Chat"
                      onClick={() => handleDeleteChat(convo.id)}
                      danger
                    />
                  </>
                );
              })()}
            </>
          ) : (
            <>
              {(() => {
                const msg = messages.find((m) => m.id === contextMenu.id);
                if (!msg) return null;
                return (
                  <>
                    <ContextMenuItem
                      icon="↩️"
                      label="Reply"
                      onClick={() => { setReplyTo(msg); setContextMenu(null); inputRef.current?.focus(); }}
                    />
                    <ContextMenuItem
                      icon="😀"
                      label="React"
                      onClick={() => { setShowReactionPicker(msg.id); setContextMenu(null); }}
                    />
                    <ContextMenuItem
                      icon={msg.is_starred ? "⭐" : "☆"}
                      label={msg.is_starred ? "Unstar" : "Star Message"}
                      onClick={() => handleStarMessage(msg.id, !msg.is_starred)}
                    />
                    <ContextMenuItem
                      icon="📋"
                      label="Copy Text"
                      onClick={() => { navigator.clipboard.writeText(msg.content); setContextMenu(null); }}
                    />
                    <div className="h-px bg-white/[0.06] my-1" />
                    <ContextMenuItem
                      icon="🗑️"
                      label="Delete Message"
                      onClick={() => handleDeleteMessage(msg.id)}
                      danger
                    />
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ════════════ IMAGE PREVIEW MODAL ════════════ */}
      {imagePreview && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
          onClick={() => setImagePreview(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            onClick={() => setImagePreview(null)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img
            src={imagePreview}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Context Menu Item Component ────────────────────────────
function ContextMenuItem({ icon, label, onClick, danger }: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors ${
        danger
          ? "text-red-400 hover:bg-red-500/10"
          : "text-white/80 hover:bg-white/[0.06]"
      }`}
    >
      <span className="text-sm w-5 text-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
