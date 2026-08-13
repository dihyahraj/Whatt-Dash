"use client";

import { useState } from "react";
import type { Label } from "@/lib/types";
import { Sym } from "./ui";

export const LABEL_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

/** Label manager. Lazy-loaded — only fetched when the menu item is used. */
export default function LabelsModal({
  labels,
  userEmail,
  isAdmin,
  onCreate,
  onUpdate,
  onDelete,
  onClose,
}: {
  labels: Label[];
  userEmail: string;
  isAdmin: boolean;
  onCreate: (name: string, color: string) => void;
  onUpdate: (id: string, name: string, color: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(LABEL_COLORS[0]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const adminLabels = labels.filter((l) => l.created_by_role === "admin" || !l.created_by_role);
  const userGroups: Record<string, Label[]> = {};
  for (const l of labels.filter((l) => l.created_by_role === "user")) {
    const key = l.created_by_name || l.created_by_email || "Unknown";
    (userGroups[key] ||= []).push(l);
  }

  const canDelete = (l: Label) => isAdmin || l.created_by_email === userEmail;

  function create() {
    if (!newName.trim()) return;
    onCreate(newName.trim(), newColor);
    setNewName("");
  }

  function commitEdit() {
    if (!editId || !editName.trim()) return;
    onUpdate(editId, editName.trim(), editColor);
    setEditId(null);
    setMenuId(null);
  }

  function renderRow(l: Label) {
    const editing = editId === l.id;
    return (
      <div
        key={l.id}
        className="relative flex items-center gap-3 px-5 py-2.5 group/l tr"
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {editing ? (
          <>
            <button
              onClick={() => setEditColor(LABEL_COLORS[(LABEL_COLORS.indexOf(editColor) + 1) % LABEL_COLORS.length])}
              className="w-4 h-4 rounded-full flex-shrink-0 tr"
              style={{ background: editColor, boxShadow: `0 0 0 2px var(--surface-1), 0 0 0 4px ${editColor}` }}
            />
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commitEdit()}
              className="flex-1 text-[13px] bg-transparent focus:outline-none font-medium"
              style={{ color: "var(--text-1)", borderBottom: "1.5px solid var(--primary)" }}
              autoFocus
            />
            <button
              onClick={commitEdit}
              className="w-7 h-7 rounded-lg flex items-center justify-center tr"
              style={{ color: "var(--primary)" }}
            >
              <Sym n="check" size={16} />
            </button>
            <button
              onClick={() => setEditId(null)}
              className="w-7 h-7 rounded-lg flex items-center justify-center tr"
              style={{ color: "var(--text-4)" }}
            >
              <Sym n="close" size={16} />
            </button>
          </>
        ) : (
          <>
            <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm" style={{ background: l.color }} />
            <span className="text-[13.5px] flex-1 font-medium" style={{ color: "var(--text-1)" }}>
              {l.name}
            </span>
            {canDelete(l) && (
              <button
                onClick={() => setMenuId(menuId === l.id ? null : l.id)}
                className="opacity-0 group-hover/l:opacity-70 hover:!opacity-100 tr w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ color: "var(--text-3)" }}
              >
                <Sym n="more_vert" size={18} />
              </button>
            )}
            {menuId === l.id && (
              <>
                <div className="fixed inset-0 z-[9]" onClick={() => setMenuId(null)} />
                <div
                  className="absolute right-4 top-full z-[10] rounded-xl overflow-hidden anim-menu"
                  style={{
                    background: "var(--surface-1)",
                    boxShadow: "var(--shadow-xl)",
                    border: "1px solid var(--border)",
                    minWidth: 140,
                  }}
                >
                  <button
                    onClick={() => {
                      setEditId(l.id);
                      setEditName(l.name);
                      setEditColor(l.color);
                      setMenuId(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left tr hover:bg-[var(--surface-3)]"
                  >
                    <Sym n="edit" size={16} color="var(--text-3)" />
                    <span className="text-[13px] font-medium" style={{ color: "var(--text-1)" }}>
                      Edit
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setMenuId(null);
                      onDelete(l.id);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left tr hover:bg-[var(--danger-muted)]"
                  >
                    <Sym n="delete" size={16} color="var(--danger)" />
                    <span className="text-[13px] font-medium" style={{ color: "var(--danger)" }}>
                      Delete
                    </span>
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 anim-overlay"
      style={{ background: "var(--bg-overlay)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-[420px] max-h-[560px] overflow-hidden anim-modal"
        style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <Sym n="label" size={22} color="var(--primary)" />
            <h3 className="text-[16px] font-bold" style={{ color: "var(--text-1)" }}>
              Labels
            </h3>
            <span
              className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: "var(--surface-3)", color: "var(--text-3)" }}
            >
              {labels.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center tr hover:bg-[var(--surface-3)]"
            style={{ color: "var(--text-3)" }}
          >
            <Sym n="close" size={20} />
          </button>
        </div>

        <div className="px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex gap-2 items-center mb-2.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New label name..."
              onKeyDown={(e) => e.key === "Enter" && create()}
              className="flex-1 rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none tr"
              style={{ background: "var(--surface-3)", color: "var(--text-1)", border: "1.5px solid transparent" }}
              onFocus={(e) => (e.target.style.borderColor = "var(--border-focus)")}
              onBlur={(e) => (e.target.style.borderColor = "transparent")}
            />
            <button
              onClick={create}
              disabled={!newName.trim()}
              className="h-10 px-4 rounded-xl text-[13px] font-bold disabled:opacity-30 tr flex items-center gap-1.5"
              style={{ background: "var(--primary)", color: "var(--primary-text)" }}
            >
              <Sym n="add" size={18} />
              Add
            </button>
          </div>
          <div className="flex gap-2">
            {LABEL_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="w-7 h-7 rounded-full tr hover:scale-110"
                style={{
                  background: c,
                  boxShadow: newColor === c ? `0 0 0 2.5px var(--surface-1), 0 0 0 4.5px ${c}` : "none",
                }}
              />
            ))}
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 340 }}>
          {labels.length === 0 && (
            <div className="px-5 py-10 text-center">
              <Sym n="label_off" size={36} color="var(--text-4)" />
              <p className="text-[13px] mt-2" style={{ color: "var(--text-4)" }}>
                No labels yet
              </p>
            </div>
          )}

          {adminLabels.length > 0 && (
            <>
              <div className="px-5 pt-3 pb-1.5 flex items-center gap-2">
                <Sym n="shield" size={14} color="var(--primary)" />
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--text-4)" }}>
                  Admin Labels
                </p>
              </div>
              {adminLabels.map(renderRow)}
            </>
          )}

          {Object.entries(userGroups).map(([creator, lbls]) => (
            <div key={creator}>
              <div className="px-5 pt-3 pb-1.5 flex items-center gap-2">
                <Sym n="person" size={14} color="var(--text-3)" />
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--text-4)" }}>
                  {creator}
                </p>
              </div>
              {lbls.map(renderRow)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
