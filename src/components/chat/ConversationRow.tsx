"use client";

import { memo } from "react";
import type { ConversationWithLastMessage, Label } from "@/lib/types";
import { aclr, ft, ini, lmp } from "@/lib/format";
import { ChatAction, LabelSubmenu, MENU_SURFACE, MI, MenuDivider, Sym } from "./ui";

/**
 * One sidebar row. Memoized: with a few hundred chats loaded, an unrelated state
 * change (typing, scrolling, a poll that returned identical data) used to
 * re-render every row. Now a row only re-renders when its own data, selection or
 * menu state changes — so every callback prop must be stable in the parent.
 */
export const ConversationRow = memo(function ConversationRow({
  convo,
  selected,
  menuOpen,
  labelSubOpen,
  labels,
  isAdmin,
  onSelect,
  onToggleMenu,
  onToggleLabelSub,
  onAction,
  onToggleLabel,
}: {
  convo: ConversationWithLastMessage;
  selected: boolean;
  menuOpen: boolean;
  labelSubOpen: boolean;
  labels: Label[];
  isAdmin: boolean;
  onSelect: (id: string) => void;
  onToggleMenu: (id: string | null) => void;
  onToggleLabelSub: (id: string | null) => void;
  onAction: (action: ChatAction, convo: ConversationWithLastMessage) => void;
  onToggleLabel: (convoId: string, labelId: string, has: boolean) => void;
}) {
  const unread = convo.unread_count > 0;

  return (
    <div
      className="relative tr group"
      style={{ background: selected ? "var(--primary-muted)" : "transparent" }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "var(--surface-3)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
    >
      <div className="flex items-center px-3 py-3 cursor-pointer gap-3" onClick={() => onSelect(convo.id)}>
        <div
          className={`w-[48px] h-[48px] rounded-[16px] bg-gradient-to-br ${aclr(convo.id)} flex items-center justify-center flex-shrink-0 text-white text-[14px] font-bold shadow-sm`}
        >
          {ini(convo.name, convo.phone)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span
              className="text-[14px] truncate"
              style={{ fontWeight: unread ? 700 : 500, color: "var(--text-1)" }}
            >
              {convo.name || convo.phone}
            </span>
            <span
              className="text-[11px] flex-shrink-0 ml-2 font-medium"
              style={{ color: unread ? "var(--primary)" : "var(--text-4)" }}
            >
              {ft(convo.last_message_time || convo.updated_at)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <p
              className="text-[12.5px] truncate flex-1 min-w-0"
              style={{ color: unread ? "var(--text-2)" : "var(--text-3)" }}
            >
              {lmp(convo)}
            </p>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
              {convo.labels?.map((l) => (
                <span key={l.id} className="w-[7px] h-[7px] rounded-full" style={{ background: l.color }} />
              ))}
              {convo.is_pinned && <Sym n="push_pin" size={14} fill color="var(--text-4)" />}
              {convo.is_muted && <Sym n="notifications_off" size={14} color="var(--text-4)" />}
              {unread && (
                <span
                  className="min-w-[20px] h-[20px] rounded-full text-[10px] font-bold flex items-center justify-center px-1.5"
                  style={{ background: "var(--unread-badge)", color: "var(--unread-badge-text)" }}
                >
                  {convo.unread_count}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="relative flex-shrink-0">
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(menuOpen ? null : convo.id);
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center tr opacity-40 hover:opacity-100 group-hover:opacity-80"
            style={{ color: "var(--text-3)" }}
          >
            <Sym n="more_vert" size={18} />
          </button>
          {menuOpen && (
            <div
              data-menu
              className="rounded-2xl py-1 min-w-[200px] overflow-hidden anim-menu"
              style={MENU_SURFACE}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <MI i="push_pin" l={convo.is_pinned ? "Unpin" : "Pin"} o={() => onAction("pin", convo)} />
              <MI
                i={convo.is_muted ? "notifications_active" : "notifications_off"}
                l={convo.is_muted ? "Unmute" : "Mute"}
                o={() => onAction("mute", convo)}
              />
              <MI i="mark_email_unread" l="Mark unread" o={() => onAction("unread", convo)} />
              <MI i="contact_page" l="Save contact" o={() => onAction("save-contact", convo)} />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleLabelSub(labelSubOpen ? null : convo.id);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] tr hover:bg-[var(--primary-muted)]"
                style={{ color: "var(--text-1)" }}
              >
                <Sym n="label" size={18} />
                <span className="flex-1 text-left">Labels</span>
                <Sym n="expand_more" size={14} className={`tr ${labelSubOpen ? "rotate-180" : ""}`} />
              </button>
              {labelSubOpen && <LabelSubmenu convo={convo} labels={labels} onToggle={onToggleLabel} />}
              <MI i="archive" l="Archive" o={() => onAction("archive", convo)} />
              {isAdmin && (
                <>
                  <MenuDivider />
                  <MI i="delete" l="Delete" o={() => onAction("delete", convo)} d />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
