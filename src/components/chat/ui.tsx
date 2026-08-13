"use client";

import { memo } from "react";
import type { ConversationWithLastMessage, Label } from "@/lib/types";

/** Shared class fragments (kept identical to the original inline strings). */
export const s = {
  iconBtn: "w-9 h-9 rounded-xl flex items-center justify-center tr cursor-pointer",
  menuSurface: "anim-menu",
};

export const MENU_SURFACE: React.CSSProperties = {
  background: "var(--surface-2)",
  boxShadow: "var(--shadow-xl)",
  border: "1px solid var(--border)",
  backdropFilter: "blur(16px)",
  position: "absolute",
  right: 0,
  top: "100%",
  marginTop: 4,
  zIndex: 100,
  borderRadius: 16,
  overflow: "hidden",
};

/** Material Symbols glyph. */
export function Sym({
  n,
  size = 20,
  fill = false,
  color,
  className = "",
  style,
}: {
  n: string;
  size?: number;
  fill?: boolean;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`material-symbols-rounded ${className}`}
      style={{ fontSize: size, color, ...(fill ? { fontVariationSettings: "'FILL' 1" } : null), ...style }}
    >
      {n}
    </span>
  );
}

/** Menu row. */
export const MI = memo(function MI({
  i,
  l,
  o,
  d,
}: {
  i: string;
  l: string;
  o: () => void;
  d?: boolean;
}) {
  return (
    <button
      onClick={o}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] tr"
      style={{ color: d ? "var(--danger)" : "var(--text-1)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = d ? "var(--danger-muted)" : "var(--primary-muted)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <Sym n={i} size={18} />
      <span className="font-medium">{l}</span>
    </button>
  );
});

export const MenuDivider = () => <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />;

/** Label checklist shown inside a chat's context menu. */
export const LabelSubmenu = memo(function LabelSubmenu({
  convo,
  labels,
  onToggle,
}: {
  convo: ConversationWithLastMessage;
  labels: Label[];
  onToggle: (convoId: string, labelId: string, has: boolean) => void;
}) {
  return (
    <div
      className="px-2 py-1.5"
      style={{ borderTop: "1px solid var(--border)" }}
      onClick={(e) => e.stopPropagation()}
    >
      {labels.map((l) => {
        const has = !!convo.labels?.some((cl) => cl.id === l.id);
        return (
          <button
            key={l.id}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(convo.id, l.id, has);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] tr hover:bg-[var(--primary-muted)]"
          >
            <span
              className="w-3.5 h-3.5 rounded-full flex-shrink-0 tr"
              style={{
                background: has ? l.color : "transparent",
                border: `2px solid ${l.color}`,
                boxShadow: has ? `0 0 0 2px ${l.color}33` : "none",
              }}
            />
            <span style={{ color: has ? "var(--text-1)" : "var(--text-3)" }}>{l.name}</span>
          </button>
        );
      })}
      {labels.length === 0 && (
        <p className="text-[11px] px-2 py-2" style={{ color: "var(--text-4)" }}>
          No labels yet
        </p>
      )}
    </div>
  );
});

/** Actions a conversation context menu can raise. */
export type ChatAction = "pin" | "mute" | "unread" | "archive" | "delete" | "save-contact";
