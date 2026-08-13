"use client";

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Message } from "@/lib/types";
import { MessageRow } from "./MessageRow";
import { MI, Sym } from "./ui";

/**
 * Scrollable message area.
 *
 * All scroll-derived state (at-bottom, new-message pill, open bubble menu) lives
 * here rather than in the page: scrolling a chat used to update state at the top
 * of the tree, which re-rendered the sidebar and every conversation row on every
 * scroll frame.
 */
export const MessageList = memo(function MessageList({
  msgs,
  search,
  peerName,
  hasMore,
  loadingMore,
  onLoadOlder,
  onReply,
  onForward,
  onStar,
  onReact,
}: {
  msgs: Message[];
  search: string;
  peerName: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadOlder: () => void;
  onReply: (msg: Message) => void;
  onForward: (msg: Message) => void;
  onStar: (id: string, starred: boolean) => void;
  onReact: (msgId: string, emoji: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [reactPickerId, setReactPickerId] = useState<string | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ msg: Message; x: number; y: number; isMe: boolean } | null>(null);

  // Last message the reader has actually been shown (i.e. was at the bottom for).
  // State, not a ref: the "new messages" pill is derived from it during render.
  const [seenId, setSeenId] = useState<string | null>(null);
  const didInitialScroll = useRef(false);
  const prevLastId = useRef<string | null>(null);
  /** Distance from the bottom, captured just before an older page is prepended. */
  const loadAnchor = useRef<number | null>(null);

  // One lookup table instead of msgs.find() per rendered bubble (that was
  // O(messages²) work on every single re-render of a long chat).
  const byId = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of msgs) map.set(m.id, m);
    return map;
  }, [msgs]);

  // Typing in the in-chat search filters a potentially long list. Deferring it
  // keeps the keystroke itself instant and lets React drop stale filter renders
  // (it only helps because MessageRow is memoized).
  const deferredSearch = useDeferredValue(search);
  const visible = useMemo(() => {
    if (!deferredSearch) return msgs;
    const q = deferredSearch.toLowerCase();
    return msgs.filter((m) => m.content?.toLowerCase().includes(q));
  }, [msgs, deferredSearch]);

  const lastId = msgs.length ? msgs[msgs.length - 1].id : null;
  const firstId = msgs.length ? msgs[0].id : null;
  // Derived: "something newer than what you've seen exists, and you're scrolled up".
  const hasNewMsg = !isAtBottom && lastId !== null && lastId !== seenId;

  // Instant jump to the latest message on first paint — no animation, no visible scroll.
  useLayoutEffect(() => {
    if (msgs.length === 0 || didInitialScroll.current) return;
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    didInitialScroll.current = true;
    prevLastId.current = lastId;
  }, [msgs.length, lastId]);

  // Older page prepended: keep the reader where they were.
  // Anchored on distance-from-bottom (not absolute scrollHeight) and keyed on the
  // FIRST message id, so a delivery receipt or a tapped image resolving in the
  // meantime can't corrupt the restore.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || loadAnchor.current == null) return;
    const target = el.scrollHeight - loadAnchor.current;
    loadAnchor.current = null;
    if (target > 0) el.scrollTop = target;
  }, [firstId]);

  // After the first jump: follow the bottom when the reader is already there.
  // Smooth ONLY for a true append; a wholesale list swap (cached tail replaced by
  // the server page) jumps instantly, because animating across 50 fresh rows is
  // exactly the stutter that made opening a chat feel heavy.
  useLayoutEffect(() => {
    if (!didInitialScroll.current || !lastId) return;
    const previous = prevLastId.current;
    prevLastId.current = lastId;
    if (lastId === previous || !isAtBottom) return;
    const isAppend = previous !== null && byId.has(previous);
    if (isAppend) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      const el = boxRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [lastId, isAtBottom, byId]);

  useEffect(() => {
    if (!menu && !reactPickerId && !imgPreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenu(null);
      setReactPickerId(null);
      setImgPreview(null);
    };
    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest?.("[data-menu]")) return;
      setMenu(null);
      setReactPickerId(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown, true);
    };
  }, [menu, reactPickerId, imgPreview]);

  // rAF-throttled: a scroll gesture fires dozens of events per second.
  const ticking = useRef(false);
  const handleScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      ticking.current = false;
      const el = boxRef.current;
      if (!el) return;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      // Reaching the bottom means everything currently loaded has been seen.
      if (atBottom) setSeenId(lastId);
      setIsAtBottom(atBottom);
      if (el.scrollTop < 100 && hasMore && !loadingMore && loadAnchor.current == null) {
        loadAnchor.current = el.scrollHeight - el.scrollTop;
        onLoadOlder();
      }
    });
  }, [hasMore, lastId, loadingMore, onLoadOlder]);

  const openMenu = useCallback((msg: Message, anchor: { x: number; y: number; isMe: boolean }) => {
    setReactPickerId(null);
    setMenu((cur) => (cur?.msg.id === msg.id ? null : { msg, ...anchor }));
  }, []);

  const react = useCallback(
    (msgId: string, emoji: string) => {
      setReactPickerId(null);
      onReact(msgId, emoji);
    },
    [onReact],
  );

  const openImage = useCallback((url: string) => setImgPreview(url), []);

  const menuHeight = 220;
  const flipUp = menu ? menu.y + menuHeight > window.innerHeight - 20 : false;

  return (
    <div className="flex-1 min-h-0 relative flex flex-col">
      <div
        ref={boxRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2.5 sm:px-12 lg:px-20 py-3 sm:py-4"
        // overflowAnchor:none — Chrome/Firefox scroll anchoring ALSO shifts
        // scrollTop when content is prepended above the viewport, which stacked on
        // top of the manual restore above and overshot by a whole page.
        // Scroll restoration has exactly one owner here: this component.
        style={{ background: "var(--chat-bg)", overflowAnchor: "none" }}
      >
        {loadingMore && (
          <div className="flex justify-center py-3">
            <div
              className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
            />
          </div>
        )}
        {!hasMore && msgs.length > 0 && (
          <div className="flex justify-center py-3">
            <span
              className="text-[11px] px-3 py-1 rounded-full"
              style={{ background: "var(--surface-1)", color: "var(--text-4)" }}
            >
              Start of conversation
            </span>
          </div>
        )}
        {visible.map((msg, i) => (
          <MessageRow
            key={msg.id}
            msg={msg}
            replied={msg.reply_to_id ? byId.get(msg.reply_to_id) || null : null}
            showDate={
              i === 0 ||
              new Date(msg.created_at).toDateString() !== new Date(visible[i - 1].created_at).toDateString()
            }
            peerName={peerName}
            reactPickerOpen={reactPickerId === msg.id}
            onOpenMenu={openMenu}
            onReact={react}
            onOpenImage={openImage}
          />
        ))}
        <div ref={endRef} />
      </div>

      {/* Jump to latest */}
      {!isAtBottom && (
        <button
          onClick={() => {
            endRef.current?.scrollIntoView({ behavior: "smooth" });
            setSeenId(lastId);
            setIsAtBottom(true);
          }}
          className="absolute right-6 bottom-4 w-10 h-10 rounded-full flex items-center justify-center z-20 tr"
          style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)" }}
        >
          {hasNewMsg && (
            <span
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
              style={{ background: "var(--unread-badge)", color: "var(--unread-badge-text)" }}
            >
              !
            </span>
          )}
          <Sym n="expand_more" size={18} color="var(--text-1)" />
        </button>
      )}

      {/* Bubble menu */}
      {menu && (
        <div
          data-menu
          className="fixed z-[200] rounded-2xl py-1.5 min-w-[200px] anim-scale-in"
          style={{
            top: flipUp ? menu.y - menuHeight - 40 : menu.y,
            left: menu.isMe ? undefined : menu.x,
            right: menu.isMe ? window.innerWidth - menu.x : undefined,
            background: "var(--surface-2)",
            boxShadow: "var(--shadow-xl)",
            border: "1px solid var(--border)",
            backdropFilter: "blur(20px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <MI
            i="reply"
            l="Reply"
            o={() => {
              onReply(menu.msg);
              setMenu(null);
            }}
          />
          <MI
            i="add_reaction"
            l="React"
            o={() => {
              setReactPickerId(menu.msg.id);
              setMenu(null);
            }}
          />
          <MI
            i={menu.msg.is_starred ? "star" : "star_outline"}
            l={menu.msg.is_starred ? "Unstar" : "Star"}
            o={() => {
              onStar(menu.msg.id, !menu.msg.is_starred);
              setMenu(null);
            }}
          />
          <MI
            i="content_copy"
            l="Copy"
            o={() => {
              navigator.clipboard.writeText(menu.msg.content);
              setMenu(null);
            }}
          />
          <MI
            i="forward"
            l="Forward"
            o={() => {
              onForward(menu.msg);
              setMenu(null);
            }}
          />
        </div>
      )}

      {/* Lightbox */}
      {imgPreview && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "var(--bg-overlay)", backdropFilter: "blur(12px)" }}
          onClick={() => setImgPreview(null)}
        >
          <button
            className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-white"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            ✕
          </button>
          <img
            src={imgPreview}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
});
