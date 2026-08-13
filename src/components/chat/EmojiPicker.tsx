"use client";

import { useCallback, useState } from "react";
import { Sym } from "./ui";

/**
 * Emoji picker. Loaded with `next/dynamic`, so these ~400 emoji strings live in
 * their own chunk and are downloaded the first time someone opens the picker
 * instead of being part of the dashboard's initial JavaScript.
 */
const EMOJIS: Record<string, string[]> = {
  "😀": ["😀","😃","😄","😁","😅","😂","🤣","😊","😇","🙂","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","👽","👾","🤖","🎃"],
  "👋": ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪"],
  "❤️": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","💕","💞","💓","💗","💖","💘","💝","💟","♥️"],
  "🎉": ["🎉","🎊","🎈","🎁","🎀","🏆","🥇","🔥","⭐","🌟","✨","💫","🌈","☀️","🌙","💡","🔔","📌","💰","💎","📱","💻","📷","🎵","🎶","🎤","🎧","🎸","🎬","📺","📚","📝","✏️","📎","✂️"],
  "🍔": ["🍏","🍎","🍊","🍋","🍌","🍉","🍇","🍓","🍒","🍑","🍍","🥥","🥝","🍅","🥑","🥦","🌽","🥕","🍞","🧀","🍳","🥓","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🌮","🌯","🥗","🍝","🍜","🍲","🍛","🍣","🍱","🍦","🎂","🍩","🍪","☕","🍵","🍺","🍷"],
  "🐶": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🦆","🦅","🦉","🐺","🐴","🦄","🐝","🦋","🐌","🐞","🐢","🐍","🐙","🐬","🐳","🦈","🐊","🐘","🦒"],
};

const RECENT_KEY = "wd-recent-emoji";

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 32) : [];
  } catch {
    return [];
  }
}

export default function EmojiPicker({
  closing,
  onPick,
  onClose,
}: {
  closing: boolean;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [cat, setCat] = useState("recent");
  // This component is client-only (`ssr: false`), so localStorage is safe to
  // read in the initializer — no effect, no second render.
  const [recent, setRecent] = useState<string[]>(readRecent);

  const pick = useCallback(
    (em: string) => {
      setRecent((prev) => {
        const updated = [em, ...prev.filter((e) => e !== em)].slice(0, 32);
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
        return updated;
      });
      onPick(em);
    },
    [onPick],
  );

  const list = cat === "recent" ? recent : EMOJIS[cat] || [];

  return (
    <>
      <div className="fixed inset-0 z-[50]" onClick={onClose} />
      <div
        className={`absolute bottom-full mb-2 z-[51] rounded-2xl overflow-hidden left-3 right-3 sm:left-4 sm:right-auto ${closing ? "anim-popup-close" : "anim-popup"}`}
        style={{
          background: "var(--surface-1)",
          boxShadow: "var(--shadow-xl)",
          border: "1px solid var(--border)",
          maxWidth: 340,
          maxHeight: 300,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex px-2 py-1.5 gap-0.5 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
          <button
            onClick={() => setCat("recent")}
            className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center tr"
            style={{ background: cat === "recent" ? "var(--primary-muted)" : "transparent" }}
          >
            <Sym n="schedule" size={18} color={cat === "recent" ? "var(--primary)" : "var(--text-3)"} />
          </button>
          {Object.keys(EMOJIS).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className="text-[18px] w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center tr"
              style={{ background: cat === c ? "var(--primary-muted)" : "transparent" }}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="p-2.5 overflow-y-auto" style={{ height: 220 }}>
          {cat === "recent" && recent.length === 0 ? (
            <p className="text-center py-6 text-[12px]" style={{ color: "var(--text-4)" }}>
              No recent emojis yet
            </p>
          ) : (
            <div className="flex flex-wrap gap-0.5">
              {list.map((em, i) => (
                <button
                  key={`${em}-${i}`}
                  onClick={() => pick(em)}
                  className="w-10 h-10 text-[22px] rounded-lg flex items-center justify-center tr hover:bg-[var(--primary-muted)] hover:scale-110"
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
