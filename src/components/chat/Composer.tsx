"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { Message, QuickReply } from "@/lib/types";
import { Sym, s } from "./ui";

// Panels are only pulled over the network the first time they are opened.
const EmojiPicker = dynamic(() => import("./EmojiPicker"), { ssr: false });
const QuickRepliesPanel = dynamic(() => import("./QuickRepliesPanel"), { ssr: false });
const MediaPreviewModal = dynamic(() => import("./MediaPreviewModal"), { ssr: false });

const MAX_INPUT_H = 120;

/**
 * Message composer.
 *
 * The draft text lives HERE. Previously it sat at the top of the dashboard, so
 * every keystroke re-rendered the conversation list and every message bubble on
 * screen — the single biggest source of typing lag. This subtree is the only
 * thing that repaints now.
 */
export const Composer = memo(function Composer({
  peerName,
  peerPhone,
  sending,
  replyTo,
  quickReplies,
  isMobile,
  onCancelReply,
  onSend,
  onSendFile,
  onUseQuickReply,
  onCreateQuickReply,
  onUpdateQuickReply,
  onDeleteQuickReply,
}: {
  peerName: string | null;
  peerPhone: string;
  sending: boolean;
  replyTo: Message | null;
  quickReplies: QuickReply[];
  isMobile: boolean;
  onCancelReply: () => void;
  onSend: (text: string) => Promise<boolean>;
  onSendFile: (file: File, caption: string, forceType: string | null) => void;
  onUseQuickReply: (qr: QuickReply) => void;
  onCreateQuickReply: (data: { title: string; content: string; category: string | null }) => void;
  onUpdateQuickReply: (id: string, data: { title: string; content: string; category: string | null }) => void;
  onDeleteQuickReply: (id: string) => void;
}) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiClosing, setEmojiClosing] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrClosing, setQrClosing] = useState(false);
  const [mobilePlus, setMobilePlus] = useState(false);
  const [slashActive, setSlashActive] = useState(false);
  const [slashIdx, setSlashIdx] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [forceType, setForceType] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  /** Textarea autosize — one write, no read/write ping-pong per keystroke. */
  const autosize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_H)}px`;
  }, []);

  useEffect(() => {
    autosize();
  }, [input, autosize]);

  const closeEmoji = useCallback(() => {
    setEmojiClosing(true);
    setTimeout(() => {
      setShowEmoji(false);
      setEmojiClosing(false);
    }, 200);
  }, []);

  const closeQR = useCallback(() => {
    setQrClosing(true);
    setTimeout(() => {
      setShowQR(false);
      setQrClosing(false);
    }, 200);
  }, []);

  const clearFile = useCallback(() => {
    setPreview((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setFile(null);
    setForceType(null);
  }, []);

  const pickFile = useCallback((f: File, force: string | null, withPreview: boolean) => {
    setFile(f);
    setForceType(force);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return withPreview ? URL.createObjectURL(f) : null;
    });
  }, []);

  // Clipboard paste — only mounted while a chat is open.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind !== "file") continue;
        const f = item.getAsFile();
        if (!f) continue;
        e.preventDefault();
        pickFile(f, null, f.type.startsWith("image/"));
        return;
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [pickFile]);

  useEffect(() => {
    if (!slashActive && !showEmoji && !showQR && !mobilePlus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSlashActive(false);
      setMobilePlus(false);
      if (showEmoji) closeEmoji();
      if (showQR) closeQR();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [slashActive, showEmoji, showQR, mobilePlus, closeEmoji, closeQR]);

  const slashQuery = slashActive ? input.slice(1) : "";
  const slashMatches = slashActive
    ? quickReplies.filter((qr) => !slashQuery || qr.title.toLowerCase().includes(slashQuery.toLowerCase()))
    : [];

  function applyTemplate(text: string) {
    return text.replace(/\{name\}/g, peerName || peerPhone).replace(/\{phone\}/g, peerPhone);
  }

  function insertQuickReply(qr: QuickReply) {
    setInput(applyTemplate(qr.content));
    setSlashActive(false);
    onUseQuickReply(qr);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSlashActive(false);
    const ok = await onSend(text);
    if (!ok) setInput(text); // restore the draft when the send failed
    inputRef.current?.focus();
  }

  return (
    <div
      className="relative"
      style={{
        background: "var(--bg-raised)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Reply preview */}
      {replyTo && (
        <div className="px-3 sm:px-10 lg:px-16 pt-2">
          <div
            className="flex items-center gap-3 rounded-xl px-3 py-2"
            style={{ background: "var(--surface-3)", borderLeft: "3px solid var(--primary)" }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold" style={{ color: "var(--primary)" }}>
                {replyTo.role === "user" ? peerName || peerPhone : "You"}
              </p>
              <p className="text-[12px] truncate" style={{ color: "var(--text-3)" }}>
                {replyTo.content}
              </p>
            </div>
            <button onClick={onCancelReply} style={{ color: "var(--text-4)" }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {(showEmoji || emojiClosing) && (
        <EmojiPicker
          closing={emojiClosing}
          onClose={closeEmoji}
          onPick={(em) => {
            setInput((p) => p + em);
            closeEmoji();
            inputRef.current?.focus();
          }}
        />
      )}

      {(showQR || qrClosing) && (
        <QuickRepliesPanel
          quickReplies={quickReplies}
          closing={qrClosing}
          onClose={closeQR}
          onUse={(qr) => {
            insertQuickReply(qr);
            closeQR();
          }}
          onCreate={onCreateQuickReply}
          onUpdate={onUpdateQuickReply}
          onDelete={onDeleteQuickReply}
        />
      )}

      {file && (
        <MediaPreviewModal
          file={file}
          previewUrl={preview}
          forceType={forceType}
          onCancel={clearFile}
          onSend={(caption) => {
            onSendFile(file, caption, forceType);
            clearFile();
          }}
        />
      )}

      {/* Input bar */}
      <div className="px-2 sm:px-8 lg:px-14 py-2 sm:py-3 flex items-center gap-1.5 sm:gap-2">
        {/* Mobile: + */}
        <div className="relative sm:hidden flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMobilePlus((v) => !v);
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              color: mobilePlus ? "var(--primary)" : "var(--text-3)",
              background: mobilePlus ? "var(--primary-muted)" : "transparent",
              transition: "color 0.25s, background-color 0.25s",
            }}
          >
            <Sym
              n="add"
              size={24}
              style={{
                transition: "transform 0.25s cubic-bezier(0.16,1,0.3,1)",
                transform: mobilePlus ? "rotate(45deg)" : "rotate(0deg)",
              }}
            />
          </button>
          {mobilePlus && (
            <>
              <div className="fixed inset-0 z-[48]" onClick={() => setMobilePlus(false)} />
              <div
                className="absolute bottom-full mb-2 left-0 z-[49] rounded-xl overflow-hidden anim-popup"
                style={{
                  background: "var(--surface-1)",
                  boxShadow: "var(--shadow-xl)",
                  border: "1px solid var(--border)",
                  width: 190,
                }}
              >
                <button
                  onClick={() => {
                    setMobilePlus(false);
                    if (showQR) closeQR();
                    else setShowQR(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left tr hover:bg-[var(--primary-muted)]"
                  style={{ color: "var(--text-1)", borderBottom: "1px solid var(--border)" }}
                >
                  <Sym n="bolt" size={20} color="var(--primary)" />
                  <span className="text-[13px] font-medium">Quick Replies</span>
                </button>
                <button
                  onClick={() => {
                    setMobilePlus(false);
                    document.getElementById("gallery-input")?.click();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left tr hover:bg-[var(--primary-muted)]"
                  style={{ color: "var(--text-1)", borderBottom: "1px solid var(--border)" }}
                >
                  <Sym n="photo_library" size={20} color="#10b981" />
                  <span className="text-[13px] font-medium">Gallery</span>
                </button>
                <button
                  onClick={() => {
                    setMobilePlus(false);
                    document.getElementById("file-input")?.click();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left tr hover:bg-[var(--primary-muted)]"
                  style={{ color: "var(--text-1)", borderBottom: "1px solid var(--border)" }}
                >
                  <Sym n="description" size={20} color="#3b82f6" />
                  <span className="text-[13px] font-medium">Document</span>
                </button>
                <button
                  onClick={() => {
                    setMobilePlus(false);
                    document.getElementById("voice-input")?.click();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left tr hover:bg-[var(--primary-muted)]"
                  style={{ color: "var(--text-1)" }}
                >
                  <Sym n="mic" size={20} color="#f59e0b" />
                  <span className="text-[13px] font-medium">Voice</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Desktop buttons */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (showEmoji) closeEmoji();
            else {
              setShowEmoji(true);
              setShowQR(false);
              setQrClosing(false);
            }
          }}
          className={`${s.iconBtn} hidden sm:flex flex-shrink-0`}
          style={{
            color: showEmoji ? "var(--primary)" : "var(--text-3)",
            background: showEmoji ? "var(--primary-muted)" : "transparent",
          }}
        >
          <Sym n="mood" size={22} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (showQR) closeQR();
            else {
              setShowQR(true);
              setShowEmoji(false);
              setEmojiClosing(false);
            }
          }}
          className={`${s.iconBtn} hidden sm:flex flex-shrink-0`}
          style={{
            color: showQR ? "var(--primary)" : "var(--text-3)",
            background: showQR ? "var(--primary-muted)" : "transparent",
          }}
        >
          <Sym n="bolt" size={22} />
        </button>
        <button
          onClick={() => document.getElementById("all-file-input")?.click()}
          className={`${s.iconBtn} hidden sm:flex flex-shrink-0`}
          style={{ color: "var(--text-3)" }}
        >
          <Sym n="attach_file" size={22} />
        </button>

        <input
          id="all-file-input"
          type="file"
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            pickFile(f, null, /^(image|video|audio)\//.test(f.type));
          }}
        />
        <input
          id="file-input"
          type="file"
          className="hidden"
          accept="*/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) pickFile(f, "document", false);
          }}
        />
        <input
          id="gallery-input"
          type="file"
          className="hidden"
          accept="image/*,video/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) pickFile(f, null, true);
          }}
        />
        <input
          id="voice-input"
          type="file"
          className="hidden"
          accept="audio/*,.ogg,.opus,.mp3,.m4a,.wav"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) pickFile(f, "audio", true);
          }}
        />

        <div
          className="flex-1 min-w-0 rounded-2xl px-3 sm:px-4 py-2 relative cursor-text"
          onClick={() => inputRef.current?.focus()}
          style={{
            background: "var(--surface-3)",
            border: `1.5px solid ${focused ? "var(--primary)" : "var(--border)"}`,
            transition: "border-color 0.2s ease",
          }}
        >
          {slashActive && slashMatches.length > 0 && (
            <div
              className="absolute bottom-full mb-2 left-0 right-0 z-[52] rounded-xl overflow-hidden anim-scale-in"
              style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)" }}
            >
              <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <span
                  className="text-[12px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: "var(--primary-muted)", color: "var(--primary)" }}
                >
                  /
                </span>
                <span className="text-[12px] font-medium" style={{ color: "var(--text-3)" }}>
                  Quick replies
                </span>
                <span className="text-[10px] ml-auto hidden sm:block" style={{ color: "var(--text-4)" }}>
                  ↑↓ Enter
                </span>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
                {slashMatches.map((qr, i) => (
                  <button
                    key={qr.id}
                    onClick={() => insertQuickReply(qr)}
                    className="w-full flex items-start gap-2 px-3 py-2.5 text-left tr"
                    style={{ background: i === slashIdx ? "var(--primary-muted)" : "transparent" }}
                  >
                    <span className="text-[12px] font-bold flex-shrink-0" style={{ color: "var(--primary)" }}>
                      {qr.title}
                    </span>
                    <span className="text-[11px] truncate flex-1" style={{ color: "var(--text-3)" }}>
                      {qr.content}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              const v = e.target.value;
              setInput(v);
              if (v.startsWith("/")) {
                setSlashActive(true);
                setSlashIdx(0);
              } else {
                setSlashActive(false);
              }
            }}
            onKeyDown={(e) => {
              if (slashActive && slashMatches.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSlashIdx((i) => Math.min(i + 1, slashMatches.length - 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSlashIdx((i) => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === "Enter" && slashMatches[slashIdx]) {
                  e.preventDefault();
                  insertQuickReply(slashMatches[slashIdx]);
                  return;
                }
                if (e.key === "Escape") {
                  setSlashActive(false);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type or / for quick replies"
            rows={1}
            className="w-full bg-transparent text-[14px] focus:outline-none resize-none leading-[1.5] overflow-y-auto"
            style={{ color: "var(--text-1)", maxHeight: MAX_INPUT_H }}
          />
        </div>

        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="w-10 h-10 rounded-full disabled:opacity-20 tr flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--primary)" }}
        >
          {sending ? (
            <Sym n="progress_activity" size={20} color="var(--primary-text)" className="animate-spin" />
          ) : (
            <Sym n="send" size={20} fill color="var(--primary-text)" />
          )}
        </button>
      </div>
    </div>
  );
});
