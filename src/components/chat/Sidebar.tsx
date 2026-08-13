"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { ConversationWithLastMessage, Label } from "@/lib/types";
import { aclr, ini, lmp } from "@/lib/format";
import { ConversationRow } from "./ConversationRow";
import { ChatAction, MI, MenuDivider, Sym, s } from "./ui";

type Theme = "light" | "dark" | "system";

/**
 * Conversation sidebar.
 *
 * Owns every piece of list-side UI state (search text, open menus, archived
 * drawer) so a keystroke in the search box re-renders this subtree only — the
 * open chat and its messages are untouched. Search and filtering are sent to the
 * server, which is also what makes them correct now that the list is paginated:
 * filtering in the browser could only ever see the page that happened to be
 * loaded.
 */
export const Sidebar = memo(function Sidebar({
  convos,
  archived,
  labels,
  displayName,
  isAdmin,
  selId,
  filter,
  hidden,
  loading,
  hasMore,
  theme,
  onQueryChange,
  onFilterChange,
  onLoadMore,
  onSelect,
  onAction,
  onToggleLabel,
  onOpenArchived,
  onUnarchive,
  onDeleteChat,
  onTheme,
  onOpenLabels,
  onOpen2FA,
  onManageUsers,
  onExportContacts,
  onSignOut,
}: {
  convos: ConversationWithLastMessage[];
  archived: ConversationWithLastMessage[] | null;
  labels: Label[];
  displayName: string;
  isAdmin: boolean;
  selId: string | null;
  filter: string;
  hidden: boolean;
  loading: boolean;
  hasMore: boolean;
  theme: Theme;
  onQueryChange: (q: string) => void;
  onFilterChange: (f: string) => void;
  onLoadMore: () => void;
  onSelect: (id: string) => void;
  onAction: (action: ChatAction, convo: ConversationWithLastMessage) => void;
  onToggleLabel: (convoId: string, labelId: string, has: boolean) => void;
  onOpenArchived: () => void;
  onUnarchive: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onTheme: (t: Theme) => void;
  onOpenLabels: () => void;
  onOpen2FA: () => void;
  onManageUsers: () => void;
  onExportContacts: () => void;
  onSignOut: () => void;
}) {
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatMenuId, setChatMenuId] = useState<string | null>(null);
  const [labelSubId, setLabelSubId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounced: one request per pause in typing, not one per keystroke.
  useEffect(() => {
    const t = setTimeout(() => onQueryChange(search.trim()), 280);
    return () => clearTimeout(t);
  }, [search, onQueryChange]);

  // Close menus on outside click / scroll.
  useEffect(() => {
    if (!menuOpen && !chatMenuId) return;
    const close = (e: Event) => {
      if (e.type === "mousedown" && (e.target as HTMLElement)?.closest?.("[data-menu]")) return;
      setMenuOpen(false);
      setChatMenuId(null);
      setLabelSubId(null);
    };
    document.addEventListener("mousedown", close, true);
    document.addEventListener("scroll", close, true);
    document.addEventListener("touchmove", close, true);
    return () => {
      document.removeEventListener("mousedown", close, true);
      document.removeEventListener("scroll", close, true);
      document.removeEventListener("touchmove", close, true);
    };
  }, [menuOpen, chatMenuId]);

  // Infinite scroll — one rAF-throttled check per scroll burst.
  const ticking = useRef(false);
  const handleScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      ticking.current = false;
      const el = listRef.current;
      if (!el) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) onLoadMore();
    });
  }, [onLoadMore]);

  const selectChat = useCallback(
    (id: string) => {
      setChatMenuId(null);
      onSelect(id);
    },
    [onSelect],
  );

  const handleAction = useCallback(
    (action: ChatAction, convo: ConversationWithLastMessage) => {
      setChatMenuId(null);
      setLabelSubId(null);
      onAction(action, convo);
    },
    [onAction],
  );

  return (
    <div
      className={`${hidden ? "hidden md:flex" : "flex"} w-full md:w-[380px] flex-col flex-shrink-0 tr`}
      style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)" }}
    >
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-[14px] flex items-center justify-center shadow-md"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-soft))" }}
            >
              <Sym n="chat" size={24} fill className="text-white" />
            </div>
            <div>
              <h1 className="text-[16px] font-extrabold tracking-tight" style={{ color: "var(--text-1)" }}>
                Whatt Dash
              </h1>
              <p className="text-[11px] font-medium" style={{ color: "var(--text-4)" }}>
                {displayName} · {convos.length}
                {hasMore ? "+" : ""} chats
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setShowSearch((v) => !v)}
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
                  style={{
                    background: "var(--surface-2)",
                    boxShadow: "var(--shadow-xl)",
                    border: "1px solid var(--border)",
                    backdropFilter: "blur(20px)",
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    marginTop: 4,
                    zIndex: 100,
                    minWidth: 220,
                    borderRadius: 16,
                    overflow: "hidden",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 pt-2.5 pb-1">
                    <p
                      className="text-[10px] font-bold tracking-[0.08em] uppercase"
                      style={{ color: "var(--text-4)" }}
                    >
                      Theme
                    </p>
                  </div>
                  <div className="px-3 pb-1.5 flex gap-1">
                    {(
                      [
                        ["light", "light_mode", "Light"],
                        ["dark", "dark_mode", "Dark"],
                        ["system", "desktop_windows", "System"],
                      ] as const
                    ).map(([val, icon, label]) => (
                      <button
                        key={val}
                        onClick={() => {
                          onTheme(val);
                          setMenuOpen(false);
                        }}
                        className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl tr"
                        style={{
                          background: theme === val ? "var(--primary-muted)" : "transparent",
                          color: theme === val ? "var(--primary)" : "var(--text-3)",
                        }}
                      >
                        <Sym n={icon} size={18} fill={theme === val} />
                        <span className="text-[10px] font-semibold">{label}</span>
                      </button>
                    ))}
                  </div>
                  <MenuDivider />
                  <MI
                    i="security"
                    l="Two-Factor Auth"
                    o={() => {
                      setMenuOpen(false);
                      onOpen2FA();
                    }}
                  />
                  <MI
                    i="label"
                    l="Manage Labels"
                    o={() => {
                      setMenuOpen(false);
                      onOpenLabels();
                    }}
                  />
                  {isAdmin && (
                    <MI
                      i="group"
                      l="Manage Users"
                      o={() => {
                        setMenuOpen(false);
                        onManageUsers();
                      }}
                    />
                  )}
                  {isAdmin && (
                    <MI
                      i="download"
                      l="Export Contacts"
                      o={() => {
                        setMenuOpen(false);
                        onExportContacts();
                      }}
                    />
                  )}
                  {isAdmin && <MenuDivider />}
                  <MI
                    i="logout"
                    l="Sign Out"
                    o={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                    d
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        {showSearch && (
          <div className="relative mt-3 anim-fade-up">
            <Sym
              n="search"
              size={18}
              color="var(--text-4)"
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-[13px] focus:outline-none tr"
              style={{ background: "var(--surface-3)", color: "var(--text-1)", border: "1.5px solid transparent" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--border-focus)")}
              onBlur={(e) => (e.target.style.borderColor = "transparent")}
              autoFocus
            />
          </div>
        )}
      </div>

      {/* ── Filter chips ── */}
      <div
        className="px-3 py-2.5 flex gap-2 overflow-x-auto items-start"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {[
          { id: "all", label: "All" },
          { id: "unread", label: "Unread" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className="px-3.5 py-[6px] rounded-full text-[12px] font-semibold flex-shrink-0 tr"
            style={{
              background: filter === f.id ? "var(--primary)" : "var(--surface-3)",
              color: filter === f.id ? "var(--primary-text)" : "var(--text-3)",
              boxShadow: filter === f.id ? "var(--shadow-sm)" : "none",
            }}
          >
            {f.label}
          </button>
        ))}
        {labels.map((l) => (
          <button
            key={l.id}
            onClick={() => onFilterChange(filter === l.id ? "all" : l.id)}
            className="px-3.5 py-[5px] rounded-xl text-[12px] font-semibold flex-shrink-0 tr flex flex-col items-center gap-0"
            style={{
              background: filter === l.id ? l.color : "var(--surface-3)",
              color: filter === l.id ? "#fff" : "var(--text-3)",
              minWidth: 60,
            }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: filter === l.id ? "#fff" : l.color }}
              />
              <span>{l.name}</span>
            </div>
            <span className="text-[9px] font-medium" style={{ opacity: 0.6 }}>
              {l.created_by_role === "admin" ? "Admin" : l.created_by_name || ""}
            </span>
          </button>
        ))}
      </div>

      {/* ── List ── */}
      <div ref={listRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {convos.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Sym n="forum" size={32} color="var(--text-4)" />
            <p className="text-[13px]" style={{ color: "var(--text-4)" }}>
              {search ? "No results" : "No conversations"}
            </p>
          </div>
        )}
        {convos.map((c) => (
          <ConversationRow
            key={c.id}
            convo={c}
            selected={selId === c.id}
            menuOpen={chatMenuId === c.id}
            labelSubOpen={labelSubId === c.id}
            labels={labels}
            isAdmin={isAdmin}
            onSelect={selectChat}
            onToggleMenu={setChatMenuId}
            onToggleLabelSub={setLabelSubId}
            onAction={handleAction}
            onToggleLabel={onToggleLabel}
          />
        ))}
        {loading && (
          <div className="flex justify-center py-4">
            <div
              className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
            />
          </div>
        )}

        {/* Archived — fetched only when opened, never on page load. */}
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => {
              const next = !showArchived;
              setShowArchived(next);
              if (next) onOpenArchived();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 tr hover:bg-[var(--surface-3)]"
            style={{ color: "var(--text-3)" }}
          >
            <Sym n="archive" size={20} />
            <span className="text-[13px] font-semibold">
              Archived{archived ? ` (${archived.length})` : ""}
            </span>
            <Sym n="expand_more" size={14} className={`tr ${showArchived ? "rotate-180" : ""}`} style={{ marginLeft: "auto" }} />
          </button>
          {showArchived && archived?.length === 0 && (
            <p className="text-[12px] px-4 pb-3" style={{ color: "var(--text-4)" }}>
              Nothing archived
            </p>
          )}
          {showArchived &&
            archived?.map((ac) => (
              <div key={ac.id} className="flex items-center px-3 py-2.5 tr hover:bg-[var(--surface-3)]">
                <div
                  className={`w-10 h-10 rounded-[14px] bg-gradient-to-br ${aclr(ac.id)} flex items-center justify-center flex-shrink-0 text-white text-[12px] font-bold opacity-50`}
                >
                  {ini(ac.name, ac.phone)}
                </div>
                <div className="flex-1 min-w-0 ml-3 cursor-pointer" onClick={() => selectChat(ac.id)}>
                  <span className="text-[13px] truncate block" style={{ color: "var(--text-3)" }}>
                    {ac.name || ac.phone}
                  </span>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-4)" }}>
                    {lmp(ac)}
                  </p>
                </div>
                <div className="flex gap-1.5 ml-2 flex-shrink-0">
                  <button
                    onClick={() => onUnarchive(ac.id)}
                    className="px-2.5 py-1 text-[11px] rounded-lg font-semibold tr"
                    style={{ background: "var(--primary-muted)", color: "var(--primary)" }}
                  >
                    Unarchive
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => onDeleteChat(ac.id)}
                      className="px-2.5 py-1 text-[11px] rounded-lg font-semibold tr"
                      style={{ background: "var(--danger-muted)", color: "var(--danger)" }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
});
