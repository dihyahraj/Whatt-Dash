"use client";

import { useState } from "react";
import type { ConversationWithLastMessage, Message } from "@/lib/types";
import { aclr, ini } from "@/lib/format";
import { Sym } from "./ui";

/** "Forward to…" chat picker. Lazy-loaded. */
export default function ForwardModal({
  msg,
  convos,
  onForward,
  onClose,
}: {
  msg: Message;
  convos: ConversationWithLastMessage[];
  onForward: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "var(--bg-overlay)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-[380px] max-h-[520px] overflow-hidden anim-scale-in"
        style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-[14px] font-bold" style={{ color: "var(--text-1)" }}>
            Forward to
          </h3>
          <button onClick={onClose} style={{ color: "var(--text-4)" }}>
            ✕
          </button>
        </div>
        <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div
            className="rounded-lg px-3 py-1.5 text-[12px] truncate"
            style={{ background: "var(--surface-3)", color: "var(--text-3)" }}
          >
            {msg.content?.substring(0, 100)}
          </div>
        </div>
        {selected.size > 0 && (
          <div className="px-3 py-2 flex flex-wrap gap-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
            {Array.from(selected).map((id) => {
              const c = convos.find((x) => x.id === id);
              return c ? (
                <span
                  key={id}
                  className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium"
                  style={{ background: "var(--primary-muted)", color: "var(--primary)" }}
                >
                  {c.name || c.phone}
                  <button onClick={() => toggle(id)}>✕</button>
                </span>
              ) : null;
            })}
          </div>
        )}
        <div className="overflow-y-auto max-h-[320px]">
          {convos
            .filter((c) => c.id !== msg.conversation_id)
            .map((c) => {
              const isSel = selected.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left tr"
                  style={{ background: isSel ? "var(--primary-muted)" : "transparent" }}
                >
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 tr"
                    style={{
                      background: isSel ? "var(--primary)" : "transparent",
                      borderColor: isSel ? "var(--primary)" : "var(--text-4)",
                    }}
                  >
                    {isSel && <Sym n="check" size={14} className="text-white" />}
                  </div>
                  <div
                    className={`w-9 h-9 rounded-xl bg-gradient-to-br ${aclr(c.id)} flex items-center justify-center text-white text-[11px] font-bold`}
                  >
                    {ini(c.name, c.phone)}
                  </div>
                  <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-1)" }}>
                    {c.name || c.phone}
                  </p>
                </button>
              );
            })}
        </div>
        {selected.size > 0 && (
          <div className="px-4 py-3 flex justify-end" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              onClick={() => onForward(Array.from(selected))}
              className="font-bold px-6 py-2.5 rounded-xl text-[13px] flex items-center gap-2 shadow-md tr"
              style={{ background: "var(--primary)", color: "var(--primary-text)" }}
            >
              <Sym n="send" size={16} fill />
              Send ({selected.size})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
