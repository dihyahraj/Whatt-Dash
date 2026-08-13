"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { ConversationWithLastMessage, Label, Message, QuickReply } from "@/lib/types";
import { getCachedConversations, getCachedMessages, setCachedConversations, setCachedMessages } from "@/lib/cache";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Sidebar } from "@/components/chat/Sidebar";
import { AppShellSkeleton } from "@/components/chat/Skeletons";
import { ChatAction, Sym } from "@/components/chat/ui";

// Rarely-opened surfaces stay out of the initial bundle.
const LabelsModal = dynamic(() => import("@/components/chat/LabelsModal"), { ssr: false });
const TwoFactorModal = dynamic(() => import("@/components/chat/TwoFactorModal"), { ssr: false });
const ForwardModal = dynamic(() => import("@/components/chat/ForwardModal"), { ssr: false });

/**
 * Page sizes are deliberately close to what fits on screen. Measured on a 4x
 * CPU-throttled profile with 400-message histories, dropping the message page
 * from 50 to 25 roughly halves the long task that runs when a chat opens — the
 * viewport only ever shows ~10-12 bubbles, and scroll-up fetches the rest.
 */
const PAGE_SIZE = 25;
const MSG_PAGE = 25;
/**
 * How many cached messages to paint when a chat opens. The cache holds up to 300
 * per chat; rendering all of them on open is what made clicking a busy chat feel
 * like it "loaded everything at once". Only the tail is ever on screen — older
 * ones come back via scroll-up.
 */
const CACHE_HYDRATE = 15;
/** Rendered-message ceiling, enforced whenever the reader returns to the bottom. */
const MSG_KEEP = 60;
/** Safety net only — Realtime is the primary update path. */
const POLL_MS = 30_000;
const CACHE_DEBOUNCE_MS = 1_000;
/**
 * Realtime events are coalesced into one state update per window instead of one
 * per event. A busy inbox delivers messages in bursts — every inbound message
 * updates its conversation row, and each of those used to be its own setState,
 * its own re-sort of the whole list and its own render. At 20 messages arriving
 * together that was 20 renders; now it is one, and the ceiling is 5 per second
 * no matter how much traffic comes in.
 */
const REALTIME_FLUSH_MS = 200;
/**
 * Loaded-conversation ceiling, applied when the reader scrolls back to the top.
 * Without it the array (and the DOM) only grow as someone pages down, and every
 * later realtime patch has to walk and re-sort that whole array.
 */
const CONVO_KEEP = 50;

type Theme = "light" | "dark" | "system";

function sortConvos(list: ConversationWithLastMessage[]): ConversationWithLastMessage[] {
  return list.sort(
    (a, b) =>
      Number(!!b.is_pinned) - Number(!!a.is_pinned) ||
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

/**
 * Did anything the sidebar renders actually change?
 *
 * Compares field by field and bails on the first difference — no string building,
 * no allocation. The previous version concatenated a signature string for every
 * row on every poll, which meant allocating and throwing away a few KB of string
 * several times a minute just to discover nothing had changed.
 */
function sameConvos(a: ConversationWithLastMessage[], b: ConversationWithLastMessage[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.updated_at !== y.updated_at ||
      x.unread_count !== y.unread_count ||
      x.last_message !== y.last_message ||
      !!x.is_pinned !== !!y.is_pinned ||
      !!x.is_muted !== !!y.is_muted ||
      (x.labels?.length || 0) !== (y.labels?.length || 0)
    ) {
      return false;
    }
  }
  return true;
}

function mergeConvos(
  prev: ConversationWithLastMessage[],
  incoming: ConversationWithLastMessage[],
): ConversationWithLastMessage[] {
  const map = new Map(prev.map((c) => [c.id, c]));
  for (const c of incoming) map.set(c.id, { ...map.get(c.id), ...c });
  return sortConvos([...map.values()]);
}

/**
 * Fold a freshly fetched page into what is already on screen, so reopening a chat
 * reconciles the handful of genuinely new bubbles instead of unmounting and
 * remounting the whole list.
 *
 * Only merges when the two ranges actually touch. If the cached tail is older than
 * everything the server just returned, the chat moved on while we weren't looking
 * and stitching them together would leave an invisible hole in the history — so
 * that case replaces instead.
 */
function mergeMessages(prev: Message[], incoming: Message[], cap: number): Message[] {
  if (!prev.length || !incoming.length) return incoming;
  const kept = prev.filter((m) => !m.id.startsWith("temp_"));
  const newestKept = kept[kept.length - 1]?.created_at;
  const oldestIncoming = incoming[0].created_at;
  if (!newestKept || newestKept < oldestIncoming) return incoming;

  const map = new Map(kept.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m); // server wins
  const merged = [...map.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id.localeCompare(b.id),
  );
  return merged.length > cap ? merged.slice(-cap) : merged;
}

/** One shared AudioContext — the old code leaked a new one per notification. */
let beepCtx: AudioContext | null = null;
function beep() {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    beepCtx ||= new Ctor();
    if (beepCtx.state === "suspended") void beepCtx.resume();
    const o = beepCtx.createOscillator();
    const g = beepCtx.createGain();
    o.connect(g);
    g.connect(beepCtx.destination);
    o.frequency.value = 800;
    g.gain.value = 0.3;
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, beepCtx.currentTime + 0.3);
    o.stop(beepCtx.currentTime + 0.3);
  } catch {
    /* audio is a nice-to-have */
  }
}

export default function Dashboard() {
  const { user, loading: authLoading, signOut, supabase } = useAuth();
  const router = useRouter();

  /* ═══ THEME ═══ */
  const [theme, setTheme] = useState<Theme>("dark");
  const applyTheme = useCallback((t: Theme) => {
    const resolved = t === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
    document.documentElement.setAttribute("data-theme", resolved);
  }, []);
  useEffect(() => {
    const saved = (localStorage.getItem("wd-theme") as Theme | null) || "dark";
    setTheme(saved);
    applyTheme(saved);
  }, [applyTheme]);
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, applyTheme]);
  const pickTheme = useCallback(
    (t: Theme) => {
      setTheme(t);
      localStorage.setItem("wd-theme", t);
      applyTheme(t);
    },
    [applyTheme],
  );

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* ═══ DATA ═══ */
  const [convos, setConvos] = useState<ConversationWithLastMessage[]>([]);
  const [hasMoreConvos, setHasMoreConvos] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [archived, setArchived] = useState<ConversationWithLastMessage[] | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const [selId, setSelId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [hasMoreMsgs, setHasMoreMsgs] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSendingState] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [show2FA, setShow2FA] = useState(false);

  const sendingRef = useRef(false);
  const setSending = useCallback((v: boolean) => {
    sendingRef.current = v;
    setSendingState(v);
  }, []);
  const skipPollRef = useRef(false);
  const lastSentIdsRef = useRef<Set<string>>(new Set());
  const scopeRef = useRef("anon");
  const selIdRef = useRef<string | null>(null);
  const msgsRef = useRef<Message[]>([]);
  const convosRef = useRef<ConversationWithLastMessage[]>([]);
  const filterRef = useRef("all");
  const queryRef = useRef("");
  const nextCursor = useRef<string | null>(null);
  const loadingMoreConvos = useRef(false);

  // Mirrors of the two big lists for async callbacks (polling, realtime, request
  // handlers) that must not close over a stale render. Assigned after commit so
  // render itself never touches a ref.
  useEffect(() => {
    msgsRef.current = msgs;
  }, [msgs]);
  useEffect(() => {
    convosRef.current = convos;
  }, [convos]);
  useEffect(() => {
    filterRef.current = filter;
    queryRef.current = query;
  }, [filter, query]);

  const sel = useMemo(
    () => convos.find((c) => c.id === selId) || archived?.find((c) => c.id === selId) || null,
    [convos, archived, selId],
  );
  const isAdmin = user?.role === "admin";

  const pausePoll = useCallback((ms = 4000) => {
    skipPollRef.current = true;
    setTimeout(() => {
      skipPollRef.current = false;
    }, ms);
  }, []);

  /* ═══ CONVERSATION LIST ═══ */
  // Keyset cursor, not an offset: the list is ordered by updated_at, which moves
  // whenever a message arrives, so an offset would serve some chats twice and
  // never serve the ones they displaced.
  const listUrl = useCallback(
    (cursor: string | null) => {
      const p = new URLSearchParams({ limit: String(PAGE_SIZE), filter });
      if (cursor) p.set("cursor", cursor);
      if (query) p.set("q", query);
      // Search mode pages by offset server-side; keyset applies to the plain list.
      if (query && cursor) p.set("offset", String(convosRef.current.length));
      return `/api/conversations?${p}`;
    },
    [filter, query],
  );

  // Page 1 — replaces the list (used on mount and whenever filter/search change).
  const loadFirstPage = useCallback(
    async (mode: "replace" | "merge") => {
      try {
        const r = await fetch(listUrl(null));
        const d = await r.json();
        if (!Array.isArray(d?.items)) return;
        setHasMoreConvos(!!d.hasMore);
        // A background refresh must not rewind a cursor the user has scrolled past.
        if (mode === "replace") nextCursor.current = d.nextCursor ?? null;
        setConvos((prev) => {
          const next = mode === "replace" ? sortConvos(d.items) : mergeConvos(prev, d.items);
          return sameConvos(prev, next) ? prev : next;
        });
      } catch {
        /* offline — cached list stays on screen */
      } finally {
        setLoadingConvos(false);
      }
    },
    [listUrl],
  );

  const loadMoreConvos = useCallback(async () => {
    if (loadingMoreConvos.current || !hasMoreConvos) return;
    // Fall back to the oldest row we hold if the server didn't hand back a cursor.
    const cursor =
      nextCursor.current || convosRef.current[convosRef.current.length - 1]?.updated_at || null;
    if (!cursor) return;
    loadingMoreConvos.current = true;
    try {
      const r = await fetch(listUrl(cursor));
      const d = await r.json();
      if (Array.isArray(d?.items)) {
        setHasMoreConvos(!!d.hasMore);
        nextCursor.current = d.nextCursor ?? null;
        setConvos((prev) => mergeConvos(prev, d.items));
      }
    } catch {
      /* ignore */
    } finally {
      loadingMoreConvos.current = false;
    }
  }, [hasMoreConvos, listUrl]);

  // Filter / search change → fresh first page.
  useEffect(() => {
    setLoadingConvos(true);
    loadFirstPage("replace");
  }, [loadFirstPage]);

  const loadArchived = useCallback(async () => {
    try {
      const r = await fetch("/api/conversations/archived?limit=60");
      const d = await r.json();
      if (Array.isArray(d?.items)) setArchived(d.items);
    } catch {
      setArchived([]);
    }
  }, []);

  const loadLabels = useCallback(async () => {
    try {
      const r = await fetch("/api/labels");
      const d = await r.json();
      if (Array.isArray(d)) setLabels(d);
    } catch {
      /* ignore */
    }
  }, []);

  const loadQuickReplies = useCallback(async () => {
    try {
      const r = await fetch("/api/quick-replies");
      const d = await r.json();
      if (Array.isArray(d)) setQuickReplies(d);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadLabels();
    loadQuickReplies();
  }, [loadLabels, loadQuickReplies]);

  // Instant paint from the offline cache, then the network refreshes it.
  useEffect(() => {
    const scope = user?.id;
    if (!scope) return;
    scopeRef.current = scope;
    getCachedConversations(scope).then((cached) => {
      if (cached?.length) setConvos((prev) => (prev.length ? prev : cached));
    });
  }, [user?.id]);

  // Debounced cache writes (was: a full rewrite on every poll).
  useEffect(() => {
    if (!convos.length) return;
    const t = setTimeout(() => setCachedConversations(scopeRef.current, convos), CACHE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [convos]);

  useEffect(() => {
    if (!selId || !msgs.length) return;
    const id = selId;
    const t = setTimeout(() => setCachedMessages(scopeRef.current, id, msgsRef.current), CACHE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [msgs, selId]);

  /* ═══ MESSAGES ═══ */
  const markRead = useCallback((id: string) => {
    const convo = convosRef.current.find((c) => c.id === id);
    // Already zero in the list we hold → no request at all. (The route also
    // guards with `unread_count > 0`, so an unknown chat costs one no-op call.)
    if (convo && convo.unread_count === 0) return;
    if (convo) setConvos((prev) => prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)));
    fetch(`/api/conversations/${id}/read`, { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    selIdRef.current = selId;
    if (!selId) {
      setMsgs([]);
      return;
    }
    const id = selId;
    setMsgs([]);
    setHasMoreMsgs(true);
    setLoadingMsgs(true);
    getCachedMessages(scopeRef.current, id).then((cached) => {
      if (selIdRef.current === id && cached?.length) {
        setMsgs((prev) => (prev.length ? prev : cached.slice(-CACHE_HYDRATE)));
        setLoadingMsgs(false);
      }
    });
    fetch(`/api/conversations/${id}/messages?limit=${MSG_PAGE}`)
      .then((r) => r.json())
      .then((d: Message[]) => {
        if (selIdRef.current !== id || !Array.isArray(d)) return;
        setMsgs((prev) => mergeMessages(prev, d, MSG_KEEP));
        setHasMoreMsgs(d.length >= MSG_PAGE);
      })
      .catch(() => {})
      .finally(() => {
        if (selIdRef.current === id) setLoadingMsgs(false);
      });
    markRead(id);
  }, [selId, markRead]);

  const loadOlderMsgs = useCallback(async () => {
    const id = selIdRef.current;
    const oldest = msgsRef.current[0];
    if (!id || !oldest || loadingMore) return;
    setLoadingMore(true);
    try {
      // (created_at, id) cursor — messages inserted in one webhook batch share a
      // timestamp, so a timestamp-only cursor would skip all but the first.
      const p = new URLSearchParams({
        limit: String(MSG_PAGE),
        before: oldest.created_at,
        beforeId: oldest.id,
      });
      const r = await fetch(`/api/conversations/${id}/messages?${p}`);
      const d = await r.json();
      if (Array.isArray(d)) {
        if (d.length < MSG_PAGE) setHasMoreMsgs(false);
        if (d.length && selIdRef.current === id) setMsgs((prev) => [...d, ...prev]);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  /**
   * Back at the top of the sidebar: drop the pages scrolled past. Every realtime
   * patch walks and re-sorts the loaded array, so letting it grow to hundreds of
   * rows makes each inbound message more expensive than the last.
   */
  const trimConvos = useCallback(() => {
    if (convosRef.current.length <= CONVO_KEEP) return;
    setConvos((prev) => (prev.length > CONVO_KEEP ? prev.slice(0, CONVO_KEEP) : prev));
    setHasMoreConvos(true);
    nextCursor.current = null;
  }, []);

  /**
   * Back at the latest message: drop the older pages the reader scrolled through.
   * Without this the DOM only ever grows — measured at 4,800 nodes after paging
   * back through 300 messages, and it never came back down for the rest of the
   * session. The dropped pages are off-screen and one fetch away.
   */
  const trimToTail = useCallback(() => {
    if (msgsRef.current.length <= MSG_KEEP) return;
    setMsgs((prev) => (prev.length > MSG_KEEP ? prev.slice(-MSG_KEEP) : prev));
    setHasMoreMsgs(true);
  }, []);

  /** Delta poll: only messages newer than the newest one we hold. */
  const fetchNewMsgs = useCallback(async (id: string) => {
    const known = msgsRef.current.filter((m) => !m.id.startsWith("temp_"));
    const newest = known[known.length - 1];
    if (!newest) return;
    try {
      const p = new URLSearchParams({
        limit: "100",
        after: newest.created_at,
        afterId: newest.id,
      });
      const r = await fetch(`/api/conversations/${id}/messages?${p}`);
      const d = await r.json();
      if (!Array.isArray(d) || !d.length || selIdRef.current !== id) return;
      setMsgs((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = d.filter((m: Message) => !seen.has(m.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
    } catch {
      /* ignore */
    }
  }, []);

  /* ═══ REALTIME ═══ */
  /** Incoming messages for the open chat, applied in batches. */
  const pendingMsgs = useRef<Message[]>([]);
  const msgFlush = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushMsgs = useCallback(() => {
    msgFlush.current = null;
    const batch = pendingMsgs.current;
    if (!batch.length) return;
    pendingMsgs.current = [];

    const id = selIdRef.current;
    let sawInbound = false;

    setMsgs((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      let next = prev; // copied lazily, so a batch of duplicates changes nothing
      const copy = () => {
        if (next === prev) next = [...prev];
        return next;
      };
      for (const m of batch) {
        if (m.conversation_id !== id) continue;
        if (m.role === "user") sawInbound = true;
        if (seen.has(m.id) || lastSentIdsRef.current.has(m.id)) continue;
        seen.add(m.id);
        // Replace our own optimistic row if it is still on screen.
        const tempIdx = next.findIndex(
          (x) => x.id.startsWith("temp_") && x.content === m.content && x.role === m.role,
        );
        if (tempIdx >= 0) {
          copy()[tempIdx] = m;
          continue;
        }
        if (m.role === "assistant" && sendingRef.current) continue;
        copy().push(m);
      }
      return next;
    });

    if (sawInbound && id) markRead(id);
  }, [markRead]);

  useEffect(() => {
    return () => {
      if (msgFlush.current) clearTimeout(msgFlush.current);
    };
  }, []);

  const notify = useCallback((title: string, body: string, tag: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico", tag });
    }
    beep();
  }, []);

  /**
   * Realtime rows land in this buffer and are applied together on a short timer.
   * One render, one re-sort per burst — see REALTIME_FLUSH_MS.
   */
  const pendingConvos = useRef<Map<string, ConversationWithLastMessage>>(new Map());
  const convoFlush = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushConvos = useCallback(() => {
    convoFlush.current = null;
    const batch = [...pendingConvos.current.values()];
    pendingConvos.current.clear();
    if (!batch.length) return;

    setConvos((prev) => {
      const index = new Map(prev.map((c) => [c.id, c]));
      let touched = false;
      for (const row of batch) {
        const known = index.get(row.id);
        if (row.is_archived) {
          if (known) {
            index.delete(row.id);
            touched = true;
          }
          continue;
        }
        if (known) {
          // Keep labels: the realtime payload doesn't carry the join.
          index.set(row.id, { ...known, ...row, labels: known.labels });
          touched = true;
        } else if (filterRef.current === "all" && !queryRef.current) {
          // A brand-new chat only belongs in an unfiltered list.
          index.set(row.id, { ...row, labels: [] });
          touched = true;
        }
      }
      if (!touched) return prev;
      const next = sortConvos([...index.values()]);
      return sameConvos(prev, next) ? prev : next;
    });
  }, []);

  /** Queue one conversation row from a realtime payload. */
  const patchConvo = useCallback(
    (row: ConversationWithLastMessage) => {
      if (!row?.id) return;

      // Notification is decided here, not in the flush: it needs the unread count
      // as it was BEFORE this event, and the buffer may coalesce several events
      // for the same chat.
      const known = convosRef.current.find((c) => c.id === row.id);
      if (
        !row.is_archived &&
        row.last_message_role === "user" &&
        row.id !== selIdRef.current &&
        !row.is_muted &&
        (row.unread_count || 0) > (known?.unread_count || 0)
      ) {
        notify(row.name || row.phone || "New Message", (row.last_message || "New message").slice(0, 100), row.id);
      }

      pendingConvos.current.set(row.id, row);
      convoFlush.current ||= setTimeout(flushConvos, REALTIME_FLUSH_MS);
    },
    [flushConvos, notify],
  );

  useEffect(() => {
    return () => {
      if (convoFlush.current) clearTimeout(convoFlush.current);
    };
  }, []);

  // Sidebar: patched straight from the payload. The old code called a full
  // conversation-list refetch on every single realtime event — with N tabs open
  // that turned one inbound message into N full list queries.
  useEffect(() => {
    if (!supabase) return;
    const table = { schema: "public", table: "conversations" } as const;
    // INSERT/UPDATE are filtered server-side: archived chats are never in the
    // sidebar, so their events shouldn't be delivered (and billed) to every tab.
    // DELETE is left unfiltered on purpose — Postgres only sends the primary key
    // for deletes, so a filter on any other column would drop the event.
    const channel = supabase
      .channel("wd-convos")
      .on("postgres_changes", { event: "INSERT", ...table, filter: "is_archived=eq.false" }, (p) =>
        patchConvo(p.new as ConversationWithLastMessage),
      )
      .on("postgres_changes", { event: "UPDATE", ...table, filter: "is_archived=eq.false" }, (p) =>
        patchConvo(p.new as ConversationWithLastMessage),
      )
      .on("postgres_changes", { event: "DELETE", ...table }, (p) => {
        const goneId = (p.old as { id?: string })?.id;
        if (goneId) setConvos((prev) => prev.filter((c) => c.id !== goneId));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // Deliberately NOT keyed on filter/query — those are read through refs so
    // typing in the search box doesn't tear down and re-open the subscription.
  }, [supabase, patchConvo]);

  // Messages: scoped to the OPEN chat only, instead of every row in the table.
  useEffect(() => {
    if (!supabase || !selId) return;
    const id = selId;
    const channel = supabase
      .channel(`wd-msgs-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (p) => {
          // Buffered like the conversation list: a customer sending five messages
          // in a row is one render, not five.
          pendingMsgs.current.push(p.new as Message);
          msgFlush.current ||= setTimeout(flushMsgs, REALTIME_FLUSH_MS);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (p) => {
          const u = p.new as Message;
          setMsgs((prev) => prev.map((m) => (m.id === u.id ? { ...m, ...u } : m)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      pendingMsgs.current = [];
    };
  }, [supabase, selId, flushMsgs]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  }, []);

  /* ═══ POLLING SAFETY NET ═══ */
  useEffect(() => {
    const tick = () => {
      if (document.hidden || skipPollRef.current || sendingRef.current) return;
      loadFirstPage("merge");
      if (selIdRef.current) fetchNewMsgs(selIdRef.current);
    };
    const iv = setInterval(tick, POLL_MS);
    // Catch up immediately when the tab comes back instead of polling in the background.
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadFirstPage, fetchNewMsgs]);

  useEffect(() => {
    const total = convos.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    document.title = total > 0 ? `(${total}) Whatt Dash` : "Whatt Dash";
  }, [convos]);

  // PWA back button — go to the chat list instead of exiting the app.
  useEffect(() => {
    if (selId) window.history.pushState({ chat: selId }, "");
    const onBack = () => {
      if (selIdRef.current) {
        setSelId(null);
        setSidebarOpen(true);
      }
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [selId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setForwardMsg(null);
      setShowLabels(false);
      setShow2FA(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Signed out → login. In an effect, not in render: navigation is a side effect,
  // and touching `window` while rendering breaks the server prerender.
  const needsLogin = !authLoading && !user;
  useEffect(() => {
    if (needsLogin) window.location.replace("/login");
  }, [needsLogin]);

  /* ═══ ACTIONS ═══ */
  const selectChat = useCallback(
    (id: string) => {
      setSelId(id);
      setSidebarOpen(false);
    },
    [],
  );

  const handleSend = useCallback(
    async (text: string, replyTo: Message | null): Promise<boolean> => {
      const id = selIdRef.current;
      if (!id) return false;
      const tempId = `temp_${Date.now()}`;
      const optimistic: Message = {
        id: tempId,
        conversation_id: id,
        role: "assistant",
        content: text,
        message_type: "text",
        media_url: null,
        media_mime_type: null,
        media_filename: null,
        media_caption: null,
        media_sha256: null,
        reply_to_id: replyTo?.id || null,
        reaction: null,
        reaction_msg_id: null,
        latitude: null,
        longitude: null,
        location_name: null,
        location_address: null,
        whatsapp_msg_id: null,
        is_deleted: false,
        is_starred: false,
        status: "sent",
        created_at: new Date().toISOString(),
      };
      setMsgs((prev) => [...prev, optimistic]);
      setSending(true);
      try {
        const body: Record<string, string> = { message: text };
        if (replyTo) {
          body.replyToMsgId = replyTo.id;
          if (replyTo.whatsapp_msg_id) body.replyToWhatsappId = replyTo.whatsapp_msg_id;
        }
        const r = await fetch(`/api/conversations/${id}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          setMsgs((prev) => prev.filter((m) => m.id !== tempId));
          setSending(false);
          alert("Error:\n" + JSON.stringify(d, null, 2));
          return false;
        }
        const real: Message = await r.json();
        lastSentIdsRef.current.add(real.id);
        setMsgs((prev) => prev.map((m) => (m.id === tempId ? real : m)));
        setTimeout(() => {
          setSending(false);
          setTimeout(() => lastSentIdsRef.current.delete(real.id), 10_000);
        }, 3_000);
        return true;
      } catch (e) {
        setMsgs((prev) => prev.filter((m) => m.id !== tempId));
        setSending(false);
        alert("Network Error: " + String(e));
        return false;
      }
    },
    [setSending],
  );

  const handleSendFile = useCallback(
    async (file: File, caption: string, forceType: string | null) => {
      const id = selIdRef.current;
      if (!id) return;
      const icon = file.type.startsWith("image/")
        ? "📷"
        : file.type.startsWith("video/")
          ? "🎥"
          : file.type.startsWith("audio/")
            ? "🎵"
            : "📄";
      const msgType =
        forceType ||
        (file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
            ? "video"
            : file.type.startsWith("audio/")
              ? "audio"
              : "document");
      const tempId = `temp_paste_${Date.now()}`;
      const optimistic: Message = {
        id: tempId,
        conversation_id: id,
        role: "assistant",
        content: caption ? `${icon} ${caption}` : `${icon} Sending ${file.name}...`,
        message_type: msgType as Message["message_type"],
        media_url: null,
        media_mime_type: file.type,
        media_filename: file.name,
        media_caption: caption || null,
        media_sha256: null,
        reply_to_id: null,
        reaction: null,
        reaction_msg_id: null,
        latitude: null,
        longitude: null,
        location_name: null,
        location_address: null,
        whatsapp_msg_id: null,
        is_deleted: false,
        is_starred: false,
        status: "sent",
        created_at: new Date().toISOString(),
      };
      setMsgs((prev) => [...prev, optimistic]);
      setSending(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("caption", caption);
        if (forceType) fd.append("forceType", forceType);
        const res = await fetch(`/api/conversations/${id}/send-media`, { method: "POST", body: fd });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setMsgs((prev) => prev.filter((m) => m.id !== tempId));
          setSending(false);
          alert("Error: " + JSON.stringify(d));
          return;
        }
        const real: Message = await res.json();
        lastSentIdsRef.current.add(real.id);
        setMsgs((prev) => prev.map((m) => (m.id === tempId ? real : m)));
        setTimeout(() => {
          setSending(false);
          setTimeout(() => lastSentIdsRef.current.delete(real.id), 10_000);
        }, 3_000);
      } catch (err) {
        setMsgs((prev) => prev.filter((m) => m.id !== tempId));
        setSending(false);
        alert("Error: " + String(err));
      }
    },
    [setSending],
  );

  const deleteChat = useCallback(
    (id: string) => {
      if (!confirm("Delete this chat?")) return;
      pausePoll();
      setConvos((prev) => prev.filter((c) => c.id !== id));
      setArchived((prev) => prev?.filter((c) => c.id !== id) ?? prev);
      if (selIdRef.current === id) setSelId(null);
      fetch(`/api/conversations/${id}/delete`, { method: "POST" }).catch(() => {});
    },
    [pausePoll],
  );

  const handleChatAction = useCallback(
    (action: ChatAction, convo: ConversationWithLastMessage) => {
      if (action === "save-contact") {
        window.open(`/api/conversations/${convo.id}/save-contact`, "_blank");
        return;
      }
      if (action === "delete") {
        deleteChat(convo.id);
        return;
      }
      pausePoll();
      const id = convo.id;
      if (action === "pin") {
        setConvos((prev) => sortConvos(prev.map((c) => (c.id === id ? { ...c, is_pinned: !convo.is_pinned } : c))));
        fetch(`/api/conversations/${id}/pin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: !convo.is_pinned }),
        }).catch(() => {});
      } else if (action === "mute") {
        setConvos((prev) => prev.map((c) => (c.id === id ? { ...c, is_muted: !convo.is_muted } : c)));
        fetch(`/api/conversations/${id}/mute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ muted: !convo.is_muted }),
        }).catch(() => {});
      } else if (action === "unread") {
        setConvos((prev) => prev.map((c) => (c.id === id ? { ...c, unread_count: 1 } : c)));
        fetch(`/api/conversations/${id}/unread`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unread_count: 1 }),
        }).catch(() => {});
      } else if (action === "archive") {
        setConvos((prev) => prev.filter((c) => c.id !== id));
        setArchived((prev) => (prev ? [{ ...convo, is_archived: true }, ...prev] : prev));
        if (selIdRef.current === id) setSelId(null);
        fetch(`/api/conversations/${id}/archive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true }),
        }).catch(() => {});
      }
    },
    [deleteChat, pausePoll],
  );

  const unarchive = useCallback(
    (id: string) => {
      pausePoll();
      const convo = archived?.find((c) => c.id === id);
      setArchived((prev) => prev?.filter((c) => c.id !== id) ?? prev);
      if (convo) setConvos((prev) => sortConvos([{ ...convo, is_archived: false }, ...prev]));
      fetch(`/api/conversations/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      }).catch(() => {});
    },
    [archived, pausePoll],
  );

  const starMsg = useCallback(
    (id: string, starred: boolean) => {
      pausePoll();
      setMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, is_starred: starred } : m)));
      fetch(`/api/messages/${id}/star`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred }),
      }).catch(() => {});
    },
    [pausePoll],
  );

  const reactMsg = useCallback(
    (msgId: string, emoji: string) => {
      const id = selIdRef.current;
      if (!id) return;
      pausePoll();
      const msg = msgsRef.current.find((m) => m.id === msgId);
      const next = msg?.reaction === emoji ? "" : emoji;
      setMsgs((prev) => prev.map((m) => (m.id === msgId ? { ...m, reaction: next || null } : m)));
      fetch(`/api/conversations/${id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: msgId, emoji: next, whatsappMsgId: msg?.whatsapp_msg_id || null }),
      }).catch(() => {});
    },
    [pausePoll],
  );

  const toggleLabel = useCallback(
    (convoId: string, labelId: string, has: boolean) => {
      pausePoll();
      const label = labels.find((l) => l.id === labelId);
      if (label) {
        setConvos((prev) =>
          prev.map((c) =>
            c.id !== convoId
              ? c
              : { ...c, labels: has ? c.labels.filter((l) => l.id !== labelId) : [...(c.labels || []), label] },
          ),
        );
      }
      fetch(`/api/conversations/${convoId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label_id: labelId, action: has ? "remove" : "add" }),
      }).catch(() => {});
    },
    [labels, pausePoll],
  );

  const createLabel = useCallback(
    (name: string, color: string) => {
      pausePoll();
      const optimistic: Label = {
        id: `temp_${Date.now()}`,
        name,
        color,
        created_by_email: user?.email,
        created_by_name: user?.display_name,
        created_by_role: user?.role,
      };
      setLabels((prev) => [...prev, optimistic]);
      fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          color,
          created_by_email: user?.email,
          created_by_name: user?.display_name,
          created_by_role: user?.role,
        }),
      })
        .then(() => loadLabels())
        .catch(() => {});
    },
    [loadLabels, pausePoll, user],
  );

  const updateLabel = useCallback(
    (id: string, name: string, color: string) => {
      pausePoll();
      setLabels((prev) => prev.map((l) => (l.id === id ? { ...l, name, color } : l)));
      fetch(`/api/labels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      })
        .then(async (r) => {
          if (!r.ok) alert((await r.json().catch(() => ({}))).error || "Cannot update");
          loadLabels();
          loadFirstPage("merge");
        })
        .catch(() => {});
    },
    [loadFirstPage, loadLabels, pausePoll],
  );

  const deleteLabel = useCallback(
    (id: string) => {
      if (!confirm("Delete this label?")) return;
      pausePoll();
      setLabels((prev) => prev.filter((l) => l.id !== id));
      const p = new URLSearchParams({ email: user?.email || "", role: user?.role || "user" });
      fetch(`/api/labels/${id}?${p}`, { method: "DELETE" })
        .then(async (r) => {
          if (!r.ok) alert((await r.json().catch(() => ({}))).error || "Cannot delete");
          loadLabels();
          loadFirstPage("merge");
        })
        .catch(() => {});
      if (filter === id) setFilter("all");
    },
    [filter, loadFirstPage, loadLabels, pausePoll, user],
  );

  const useQuickReply = useCallback((qr: QuickReply) => {
    setQuickReplies((prev) => prev.map((q) => (q.id === qr.id ? { ...q, usage_count: q.usage_count + 1 } : q)));
    fetch(`/api/quick-replies/${qr.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ use: true }),
    }).catch(() => {});
  }, []);

  const createQuickReply = useCallback(
    (data: { title: string; content: string; category: string | null }) => {
      fetch("/api/quick-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then(() => loadQuickReplies())
        .catch(() => {});
    },
    [loadQuickReplies],
  );

  const updateQuickReply = useCallback(
    (id: string, data: { title: string; content: string; category: string | null }) => {
      fetch(`/api/quick-replies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then(() => loadQuickReplies())
        .catch(() => {});
    },
    [loadQuickReplies],
  );

  const deleteQuickReply = useCallback(
    (id: string) => {
      if (!confirm("Delete this quick reply?")) return;
      setQuickReplies((prev) => prev.filter((q) => q.id !== id));
      fetch(`/api/quick-replies/${id}`, { method: "DELETE" })
        .then(() => loadQuickReplies())
        .catch(() => {});
    },
    [loadQuickReplies],
  );

  const forward = useCallback(
    async (ids: string[]) => {
      if (!forwardMsg || !ids.length) return;
      setForwardMsg(null);
      await fetch(`/api/messages/${forwardMsg.id}/forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetConversationIds: ids }),
      }).catch(() => {});
      loadFirstPage("merge");
    },
    [forwardMsg, loadFirstPage],
  );

  const backToList = useCallback(() => {
    setSelId(null);
    setSidebarOpen(true);
    if (window.history.state?.chat) window.history.back();
  }, []);

  const exportContacts = useCallback(() => window.open("/api/contacts/export", "_blank"), []);
  const manageUsers = useCallback(() => router.push("/admin"), [router]);
  const openLabels = useCallback(() => setShowLabels(true), []);
  const open2FA = useCallback(() => setShow2FA(true), []);

  /* ═══ AUTH GATE ═══ */
  // The app frame with skeletons, not a spinner on an empty page: the chrome and
  // the list shape are static, so they belong on screen in the first frame. The
  // real rows then fade into the same layout without anything moving.
  if (authLoading) return <AppShellSkeleton />;
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <p className="text-sm" style={{ color: "var(--text-4)" }}>
          Redirecting...
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex overflow-hidden select-none"
      style={{ background: "var(--bg)", height: "100dvh", touchAction: "manipulation" }}
    >
      <Sidebar
        convos={convos}
        archived={archived}
        labels={labels}
        displayName={user.display_name}
        isAdmin={!!isAdmin}
        selId={selId}
        filter={filter}
        hidden={!!selId && !sidebarOpen}
        loading={loadingConvos}
        hasMore={hasMoreConvos}
        theme={theme}
        onQueryChange={setQuery}
        onFilterChange={setFilter}
        onLoadMore={loadMoreConvos}
        onReachedTop={trimConvos}
        onSelect={selectChat}
        onAction={handleChatAction}
        onToggleLabel={toggleLabel}
        onOpenArchived={loadArchived}
        onUnarchive={unarchive}
        onDeleteChat={deleteChat}
        onTheme={pickTheme}
        onOpenLabels={openLabels}
        onOpen2FA={open2FA}
        onManageUsers={manageUsers}
        onExportContacts={exportContacts}
        onSignOut={signOut}
      />

      <div className={`flex-1 flex flex-col min-w-0 ${selId && !sidebarOpen ? "flex" : "hidden md:flex"}`}>
        {!sel ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6" style={{ background: "var(--bg)" }}>
            <div
              className="w-28 h-28 rounded-[28px] flex items-center justify-center"
              style={{ background: "var(--surface-3)" }}
            >
              <Sym n="forum" size={48} fill color="var(--text-4)" />
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold mb-1" style={{ color: "var(--text-2)" }}>
                Whatt Dash
              </p>
              <p className="text-[13px]" style={{ color: "var(--text-4)" }}>
                Select a chat to start messaging
              </p>
            </div>
          </div>
        ) : (
          <ChatPanel
            // Remount per chat: scroll position, reply draft and open menus reset
            // without any "clear everything when the id changes" effects.
            key={sel.id}
            convo={sel}
            msgs={msgs}
            labels={labels}
            quickReplies={quickReplies}
            isAdmin={!!isAdmin}
            isMobile={isMobile}
            sending={sending}
            hasMore={hasMoreMsgs}
            loadingMore={loadingMore}
            loadingFirstPage={loadingMsgs}
            onLoadOlder={loadOlderMsgs}
            onReachedBottom={trimToTail}
            onSend={handleSend}
            onSendFile={handleSendFile}
            onStar={starMsg}
            onReact={reactMsg}
            onForward={setForwardMsg}
            onAction={handleChatAction}
            onToggleLabel={toggleLabel}
            onBack={backToList}
            onUseQuickReply={useQuickReply}
            onCreateQuickReply={createQuickReply}
            onUpdateQuickReply={updateQuickReply}
            onDeleteQuickReply={deleteQuickReply}
          />
        )}
      </div>

      {showLabels && (
        <LabelsModal
          labels={labels}
          userEmail={user.email}
          isAdmin={!!isAdmin}
          onCreate={createLabel}
          onUpdate={updateLabel}
          onDelete={deleteLabel}
          onClose={() => setShowLabels(false)}
        />
      )}
      {show2FA && <TwoFactorModal supabase={supabase} onClose={() => setShow2FA(false)} />}
      {forwardMsg && (
        <ForwardModal
          msg={forwardMsg}
          convos={convos}
          onForward={forward}
          onClose={() => setForwardMsg(null)}
        />
      )}
    </div>
  );
}
