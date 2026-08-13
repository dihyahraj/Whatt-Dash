"use client";

import { memo } from "react";

/**
 * Loading placeholders.
 *
 * The point is that the app never shows a blank panel or a lonely spinner: the
 * real layout is on screen from the first frame, in roughly the right shape and
 * the right sizes, and the content fades into it. Because the boxes match the
 * real row heights, nothing jumps when the data lands.
 *
 * Pure markup + one compositor-only CSS animation (see `.sk` in globals.css),
 * so a skeleton costs nothing on the main thread while the real work happens.
 */

/** One conversation row placeholder — same 48px avatar + two lines as the real row. */
const SidebarRowSkeleton = memo(function SidebarRowSkeleton({ width }: { width: number }) {
  return (
    <div className="flex items-center px-3 py-3 gap-3">
      <div className="sk flex-shrink-0" style={{ width: 48, height: 48, borderRadius: 16 }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="sk" style={{ width: `${width}%`, height: 13 }} />
          <div className="sk flex-shrink-0" style={{ width: 34, height: 10 }} />
        </div>
        <div className="sk mt-2" style={{ width: `${Math.min(width + 18, 92)}%`, height: 11 }} />
      </div>
    </div>
  );
});

/** Widths vary per row so the list doesn't look like a rigid grid. */
const ROW_WIDTHS = [46, 62, 38, 55, 44, 68, 41, 58, 50, 36];

export const SidebarSkeleton = memo(function SidebarSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <SidebarRowSkeleton key={i} width={ROW_WIDTHS[i % ROW_WIDTHS.length]} />
      ))}
    </div>
  );
});

/** Bubble placeholders, alternating sides like a real conversation. */
const BUBBLES: { mine: boolean; w: number; h: number }[] = [
  { mine: false, w: 42, h: 38 },
  { mine: true, w: 34, h: 38 },
  { mine: false, w: 56, h: 56 },
  { mine: true, w: 28, h: 38 },
  { mine: false, w: 38, h: 38 },
  { mine: true, w: 48, h: 56 },
  { mine: false, w: 30, h: 38 },
  { mine: true, w: 44, h: 38 },
];

export const MessagesSkeleton = memo(function MessagesSkeleton() {
  return (
    <div className="flex-1 overflow-hidden px-2.5 sm:px-12 lg:px-20 py-3 sm:py-4 flex flex-col justify-end" aria-hidden>
      {BUBBLES.map((b, i) => (
        <div key={i} className={`flex ${b.mine ? "justify-end" : "justify-start"} mb-2`}>
          <div className="sk" style={{ width: `${b.w}%`, maxWidth: 420, height: b.h, borderRadius: 16 }} />
        </div>
      ))}
    </div>
  );
});

/**
 * The whole app frame, shown while the session is being restored.
 *
 * This replaces a centred spinner on an empty page. The brand, the sidebar
 * chrome and the list shape are all static, so they can be on screen in the
 * first frame — the layout never moves afterwards, the real rows just fade in
 * where the placeholders were.
 */
export const AppShellSkeleton = memo(function AppShellSkeleton() {
  return (
    <div
      className="flex overflow-hidden select-none"
      style={{ background: "var(--bg)", height: "100dvh" }}
      aria-busy="true"
      aria-label="Loading"
    >
      <div
        className="flex w-full md:w-[380px] flex-col flex-shrink-0"
        style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)" }}
      >
        {/* Real header: no reason to fake something we already have. */}
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-[14px] flex items-center justify-center shadow-md"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-soft))" }}
            >
              <span
                className="material-symbols-rounded text-white"
                style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}
              >
                chat
              </span>
            </div>
            <div>
              <h1 className="text-[16px] font-extrabold tracking-tight" style={{ color: "var(--text-1)" }}>
                Whatt Dash
              </h1>
              <div className="sk mt-1.5" style={{ width: 108, height: 9 }} />
            </div>
          </div>
        </div>
        <div className="px-3 py-2.5 flex gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="sk" style={{ width: 52, height: 26, borderRadius: 999 }} />
          <div className="sk" style={{ width: 68, height: 26, borderRadius: 999 }} />
          <div className="sk" style={{ width: 60, height: 26, borderRadius: 999 }} />
        </div>
        <div className="flex-1 overflow-hidden">
          <SidebarSkeleton rows={9} />
        </div>
      </div>

      <div className="flex-1 hidden md:flex flex-col min-w-0" style={{ background: "var(--chat-bg)" }}>
        <MessagesSkeleton />
      </div>
    </div>
  );
});

/** Chat header placeholder, used while the selected conversation is still unknown. */
export const ChatHeaderSkeleton = memo(function ChatHeaderSkeleton() {
  return (
    <div
      className="px-4 py-3 flex items-center gap-3"
      style={{ background: "var(--bg-raised)", borderBottom: "1px solid var(--border)" }}
      aria-hidden
    >
      <div className="sk flex-shrink-0" style={{ width: 40, height: 40, borderRadius: 14 }} />
      <div className="flex-1 min-w-0">
        <div className="sk" style={{ width: 140, height: 13 }} />
        <div className="sk mt-2" style={{ width: 96, height: 10 }} />
      </div>
    </div>
  );
});
