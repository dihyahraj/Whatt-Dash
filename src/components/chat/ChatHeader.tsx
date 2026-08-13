"use client";

import { memo, useEffect, useState } from "react";
import type { ConversationWithLastMessage, Label } from "@/lib/types";
import { aclr, ini } from "@/lib/format";
import { ChatAction, LabelSubmenu, MENU_SURFACE, MI, MenuDivider, Sym, s } from "./ui";

/** Chat title bar + its context menu and in-chat search field. */
export const ChatHeader = memo(function ChatHeader({
  convo,
  labels,
  isAdmin,
  search,
  onSearch,
  onBack,
  onAction,
  onToggleLabel,
}: {
  convo: ConversationWithLastMessage;
  labels: Label[];
  isAdmin: boolean;
  search: string;
  onSearch: (q: string) => void;
  onBack: () => void;
  onAction: (action: ChatAction, convo: ConversationWithLastMessage) => void;
  onToggleLabel: (convoId: string, labelId: string, has: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [labelSubOpen, setLabelSubOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: Event) => {
      if (e.type === "mousedown" && (e.target as HTMLElement)?.closest?.("[data-menu]")) return;
      setMenuOpen(false);
      setLabelSubOpen(false);
    };
    document.addEventListener("mousedown", close, true);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close, true);
      document.removeEventListener("scroll", close, true);
    };
  }, [menuOpen]);

  function act(action: ChatAction) {
    setMenuOpen(false);
    setLabelSubOpen(false);
    onAction(action, convo);
  }

  return (
    <>
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: "var(--bg-raised)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center -ml-1"
            style={{ color: "var(--text-1)" }}
          >
            <Sym n="arrow_back" size={24} />
          </button>
          <div
            className={`w-10 h-10 rounded-[14px] bg-gradient-to-br ${aclr(convo.id)} flex items-center justify-center text-white text-sm font-bold shadow-sm`}
          >
            {ini(convo.name, convo.phone)}
          </div>
          <div>
            <h2 className="text-[15px] font-bold tracking-tight" style={{ color: "var(--text-1)" }}>
              {convo.name || convo.phone}
            </h2>
            <p className="text-[11px] font-mono" style={{ color: "var(--text-4)" }}>
              {convo.phone}
            </p>
          </div>
        </div>
        <div className="flex items-center">
          <button
            onClick={() => {
              const next = !searchOpen;
              setSearchOpen(next);
              if (!next) onSearch("");
            }}
            className={s.iconBtn}
            style={{ color: "var(--text-3)" }}
          >
            <Sym n="search" size={20} />
          </button>
          <div className="relative">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className={s.iconBtn}
              style={{ color: "var(--text-3)" }}
            >
              <Sym n="more_vert" size={20} />
            </button>
            {menuOpen && (
              <div
                data-menu
                className="anim-menu"
                style={MENU_SURFACE}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <MI i="push_pin" l={convo.is_pinned ? "Unpin" : "Pin"} o={() => act("pin")} />
                <MI
                  i={convo.is_muted ? "notifications_active" : "notifications_off"}
                  l={convo.is_muted ? "Unmute" : "Mute"}
                  o={() => act("mute")}
                />
                <MI i="mark_email_unread" l="Mark unread" o={() => act("unread")} />
                <MI i="contact_page" l="Save contact" o={() => act("save-contact")} />
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLabelSubOpen((v) => !v);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] tr hover:bg-[var(--primary-muted)]"
                  style={{ color: "var(--text-1)" }}
                >
                  <Sym n="label" size={18} />
                  <span className="flex-1 text-left">Labels</span>
                  <Sym n="expand_more" size={14} className={`tr ${labelSubOpen ? "rotate-180" : ""}`} />
                </button>
                {labelSubOpen && <LabelSubmenu convo={convo} labels={labels} onToggle={onToggleLabel} />}
                <MI i="archive" l="Archive" o={() => act("archive")} />
                {isAdmin && (
                  <>
                    <MenuDivider />
                    <MI i="delete" l="Delete" o={() => act("delete")} d />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {searchOpen && (
        <div
          className="px-4 py-2.5 flex items-center gap-2 anim-fade-up"
          style={{ background: "var(--bg-raised)", borderBottom: "1px solid var(--border)" }}
        >
          <Sym n="search" size={18} color="var(--text-4)" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search in chat..."
            className="flex-1 bg-transparent text-[13px] focus:outline-none"
            style={{ color: "var(--text-1)" }}
            autoFocus
          />
          <button
            onClick={() => {
              setSearchOpen(false);
              onSearch("");
            }}
            style={{ color: "var(--text-4)" }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
});
