"use client";

import { useState } from "react";
import { Sym } from "./ui";

/** Preview + caption sheet shown before a file is sent. Lazy-loaded. */
export default function MediaPreviewModal({
  file,
  previewUrl,
  forceType,
  onCancel,
  onSend,
}: {
  file: File;
  previewUrl: string | null;
  forceType: string | null;
  onCancel: () => void;
  onSend: (caption: string) => void;
}) {
  const [caption, setCaption] = useState("");
  const [rotation, setRotation] = useState(0);

  const isImg = !forceType && file.type.startsWith("image/");
  const isVid = !forceType && file.type.startsWith("video/");
  const isAud = forceType === "audio" || (!forceType && file.type.startsWith("audio/"));
  const ext = file.name.split(".").pop()?.toUpperCase() || "FILE";
  const sizeStr =
    file.size > 1048576 ? (file.size / 1048576).toFixed(1) + " MB" : (file.size / 1024).toFixed(0) + " KB";
  const iconColor = isImg
    ? "#10b981"
    : isVid
      ? "#8b5cf6"
      : isAud
        ? "#f59e0b"
        : file.type.includes("pdf")
          ? "#ef4444"
          : "#3b82f6";
  const icon = isImg
    ? "image"
    : isVid
      ? "videocam"
      : isAud
        ? "mic"
        : file.type.includes("pdf")
          ? "picture_as_pdf"
          : "description";

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onCancel}
    >
      <div
        className="flex flex-col m-4 sm:m-8 rounded-3xl overflow-hidden anim-scale-in"
        style={{ background: "var(--surface-1)", maxWidth: 460, width: "100%", maxHeight: "calc(100vh - 64px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0" style={{ background: "var(--surface-2)" }}>
          <button
            onClick={onCancel}
            className="w-9 h-9 rounded-xl flex items-center justify-center tr hover:bg-[var(--surface-3)]"
            style={{ color: "var(--text-2)" }}
          >
            <Sym n="close" size={20} />
          </button>
          <Sym n={icon} size={18} color={iconColor} />
          <span className="text-[12px] font-medium truncate flex-1" style={{ color: "var(--text-2)" }}>
            {file.name}
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-md font-bold flex-shrink-0"
            style={{ background: `${iconColor}15`, color: iconColor }}
          >
            {ext} · {sizeStr}
          </span>
          {isImg && (
            <>
              <button
                onClick={() => setRotation((r) => (r - 90) % 360)}
                className="w-8 h-8 rounded-lg flex items-center justify-center tr hover:bg-[var(--surface-3)]"
                style={{ color: "var(--text-3)" }}
              >
                <Sym n="rotate_left" size={18} />
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="w-8 h-8 rounded-lg flex items-center justify-center tr hover:bg-[var(--surface-3)]"
                style={{ color: "var(--text-3)" }}
              >
                <Sym n="rotate_right" size={18} />
              </button>
            </>
          )}
        </div>

        {/* Preview */}
        <div
          className="flex-1 min-h-0 flex items-center justify-center overflow-hidden p-3"
          style={{ background: "var(--surface-3)" }}
        >
          {isImg && previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className="max-w-full max-h-full object-contain rounded-lg tr"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          ) : isVid && previewUrl ? (
            <video src={previewUrl} controls className="max-w-full max-h-full rounded-lg" />
          ) : isAud && previewUrl ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "#f59e0b18" }}>
                <Sym n="mic" size={40} color="#f59e0b" />
              </div>
              <audio src={previewUrl} controls className="w-full max-w-[280px]" />
              <p className="text-[12px] font-medium" style={{ color: "var(--text-3)" }}>
                Voice message
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: `${iconColor}15` }}
              >
                <Sym n={icon} size={36} color={iconColor} />
              </div>
              <p className="text-[13px] font-bold" style={{ color: "var(--text-1)" }}>
                {file.name}
              </p>
            </div>
          )}
        </div>

        {/* Caption + send */}
        <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{ background: "var(--surface-2)" }}>
          <div className="flex-1 rounded-xl px-3 py-2" style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSend(caption);
                if (e.key === "Escape") onCancel();
              }}
              placeholder="Add a caption..."
              autoFocus
              className="w-full bg-transparent text-[13px] focus:outline-none"
              style={{ color: "var(--text-1)" }}
            />
          </div>
          <button
            onClick={() => onSend(caption)}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 tr"
            style={{ background: "var(--primary)" }}
          >
            <Sym n="send" size={20} fill color="var(--primary-text)" />
          </button>
        </div>
      </div>
    </div>
  );
}
