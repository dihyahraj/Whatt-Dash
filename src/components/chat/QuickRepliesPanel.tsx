"use client";

import { useState } from "react";
import type { QuickReply } from "@/lib/types";
import { Sym } from "./ui";

/** Quick replies list + editor. Lazy-loaded; opens from the ⚡ button or "/". */
export default function QuickRepliesPanel({
  quickReplies,
  closing,
  onUse,
  onCreate,
  onUpdate,
  onDelete,
  onClose,
}: {
  quickReplies: QuickReply[];
  closing: boolean;
  onUse: (qr: QuickReply) => void;
  onCreate: (data: { title: string; content: string; category: string | null }) => void;
  onUpdate: (id: string, data: { title: string; content: string; category: string | null }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const matches = quickReplies.filter(
    (qr) =>
      !search ||
      qr.title.toLowerCase().includes(search.toLowerCase()) ||
      qr.content.toLowerCase().includes(search.toLowerCase()),
  );

  function reset() {
    setTitle("");
    setContent("");
    setCategory("");
    setEditId(null);
    setMode("list");
  }

  function save() {
    if (!title.trim() || !content.trim()) return;
    const data = { title: title.trim(), content: content.trim(), category: category.trim() || null };
    if (mode === "edit" && editId) onUpdate(editId, data);
    else onCreate(data);
    reset();
  }

  return (
    <>
      <div className="fixed inset-0 z-[50]" onClick={onClose} />
      <div
        className={`absolute bottom-full mb-2 z-[51] rounded-2xl overflow-hidden left-3 right-3 sm:left-4 sm:right-auto ${closing ? "anim-popup-close" : "anim-popup"}`}
        style={{
          background: "var(--surface-1)",
          boxShadow: "var(--shadow-xl)",
          border: "1px solid var(--border)",
          maxWidth: 400,
          maxHeight: 380,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Sym n="bolt" size={18} fill color="var(--primary)" />
            <span className="text-[13px] font-bold" style={{ color: "var(--text-1)" }}>
              Quick Replies
            </span>
          </div>
          <div className="flex gap-1.5">
            {mode === "list" && (
              <button
                onClick={() => {
                  setMode("add");
                  setTitle("");
                  setContent("");
                  setCategory("");
                }}
                className="text-[11px] px-3 py-1 rounded-lg font-bold"
                style={{ background: "var(--primary)", color: "var(--primary-text)" }}
              >
                + New
              </button>
            )}
            {mode !== "list" && (
              <button onClick={reset} className="text-[11px] px-2 py-1 font-medium" style={{ color: "var(--text-3)" }}>
                ← Back
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center tr hover:bg-[var(--surface-3)]"
              style={{ color: "var(--text-4)" }}
            >
              <Sym n="close" size={18} />
            </button>
          </div>
        </div>

        {mode === "list" && (
          <>
            <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-lg px-3 py-1.5 text-[12px] focus:outline-none"
                style={{ background: "var(--surface-3)", color: "var(--text-1)" }}
              />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
              {matches.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px]" style={{ color: "var(--text-4)" }}>
                  {quickReplies.length === 0 ? "No quick replies yet" : "No matches"}
                </div>
              ) : (
                matches.map((qr) => (
                  <div
                    key={qr.id}
                    className="flex items-start gap-2 px-4 py-3 group cursor-pointer tr hover:bg-[var(--surface-3)]"
                    style={{ borderBottom: "1px solid var(--border)" }}
                    onClick={() => onUse(qr)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold" style={{ color: "var(--primary)" }}>
                          {qr.title}
                        </span>
                        {qr.category && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: "var(--surface-4)", color: "var(--text-4)" }}
                          >
                            {qr.category}
                          </span>
                        )}
                        <span className="text-[10px] ml-auto" style={{ color: "var(--text-4)" }}>
                          {qr.usage_count}x
                        </span>
                      </div>
                      <p className="text-[12px] truncate mt-0.5" style={{ color: "var(--text-3)" }}>
                        {qr.content}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMode("edit");
                          setEditId(qr.id);
                          setTitle(qr.title);
                          setContent(qr.content);
                          setCategory(qr.category || "");
                        }}
                        className="w-7 h-7 rounded-md flex items-center justify-center tr hover:bg-[var(--surface-4)]"
                        style={{ color: "var(--text-3)" }}
                      >
                        <Sym n="edit" size={15} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(qr.id);
                        }}
                        className="w-7 h-7 rounded-md flex items-center justify-center tr hover:bg-[var(--danger-muted)]"
                        style={{ color: "var(--danger)" }}
                      >
                        <Sym n="delete" size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {mode !== "list" && (
          <div className="px-4 py-3 space-y-2.5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none"
              style={{ background: "var(--surface-3)", color: "var(--text-1)" }}
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Message... Use {name} for customer name"
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none resize-none"
              style={{ background: "var(--surface-3)", color: "var(--text-1)" }}
            />
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category (optional)"
              className="w-full rounded-lg px-3 py-2 text-[13px] focus:outline-none"
              style={{ background: "var(--surface-3)", color: "var(--text-1)" }}
            />
            <button
              onClick={save}
              disabled={!title.trim() || !content.trim()}
              className="w-full py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-30 tr"
              style={{ background: "var(--primary)", color: "var(--primary-text)" }}
            >
              {mode === "edit" ? "Update" : "Save"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
