"use client";

import { memo, useState } from "react";
import type { Message } from "@/lib/types";
import { dl, mt } from "@/lib/format";
import { VoicePlayer } from "./VoicePlayer";
import { Sym } from "./ui";

/* Set to true ONLY if your Supabase project is on a plan with Image
   Transformations (Pro+). It shows a tiny (~few KB) thumbnail instead of
   the plain placeholder. Falls back to the placeholder automatically if a
   thumbnail fails to load. Default false = zero download until you tap. */
const IMG_THUMBNAILS = false;

const QUICK_REACT = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

function statusIcon(st: string) {
  if (st === "sent") return <Sym n="check" size={14} color="var(--bubble-me-meta)" className="inline ml-0.5" />;
  if (st === "delivered")
    return <Sym n="done_all" size={14} color="var(--bubble-me-meta)" className="inline ml-0.5" />;
  if (st === "read") return <Sym n="done_all" size={14} color="#53bdeb" className="inline ml-0.5" />;
  return null;
}

/** Tap-to-load media placeholder — bytes are never fetched until asked for. */
const MediaThumb = memo(function MediaThumb({
  msg,
  onOpen,
}: {
  msg: Message;
  onOpen: (url: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [thumbErr, setThumbErr] = useState(false);
  const url = msg.media_url;
  const isVideo = msg.message_type === "video";
  const meta = isVideo ? { label: "Video", color: "#8b5cf6" } : { label: "Photo", color: "#10b981" };

  if (!url) {
    return (
      <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-3)" }}>
        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "var(--primary)" }} />
        <span>Receiving {meta.label.toLowerCase()}...</span>
      </div>
    );
  }

  if (loaded) {
    if (isVideo) {
      return (
        <video controls autoPlay className="rounded-xl max-w-[260px]" preload="metadata">
          <source src={url} type={msg.media_mime_type || "video/mp4"} />
        </video>
      );
    }
    return (
      <img
        src={url}
        alt=""
        className="rounded-xl max-w-[260px] max-h-[300px] object-cover cursor-pointer hover:brightness-[0.92] tr"
        decoding="async"
        fetchPriority="low"
        onClick={() => onOpen(url)}
      />
    );
  }

  const thumbUrl =
    !isVideo && IMG_THUMBNAILS && !thumbErr
      ? url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") +
        (url.includes("?") ? "&" : "?") +
        "width=220&quality=25"
      : null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setLoaded(true);
      }}
      className="relative flex flex-col items-center justify-center gap-2 rounded-xl overflow-hidden tr hover:brightness-95"
      style={{ width: 220, height: 150, background: "var(--surface-3)", border: "1px dashed var(--border)" }}
    >
      {thumbUrl && (
        <img
          src={thumbUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setThumbErr(true)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "blur(1px)" }}
        />
      )}
      <div
        className="relative w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: thumbUrl ? "rgba(0,0,0,0.45)" : `${meta.color}22` }}
      >
        <Sym
          n={isVideo ? "play_arrow" : "download"}
          size={26}
          fill={isVideo}
          color={thumbUrl ? "#fff" : meta.color}
        />
      </div>
      <span className="relative text-[12px] font-semibold" style={{ color: thumbUrl ? "#fff" : "var(--text-2)" }}>
        Tap to load {meta.label}
      </span>
    </button>
  );
});

function MessageBody({ msg, onOpenImage }: { msg: Message; onOpenImage: (url: string) => void }) {
  if (msg.is_deleted) {
    return (
      <p className="italic text-[13px]" style={{ color: "var(--text-4)" }}>
        🚫 This message was deleted
      </p>
    );
  }
  switch (msg.message_type) {
    case "image":
      return (
        <div>
          <MediaThumb msg={msg} onOpen={onOpenImage} />
          {msg.media_caption && msg.media_caption !== "[image]" && (
            <p className="text-[13px] mt-1.5 whitespace-pre-wrap select-text">{msg.media_caption}</p>
          )}
        </div>
      );
    case "video":
      return (
        <div>
          <MediaThumb msg={msg} onOpen={onOpenImage} />
          {msg.media_caption && <p className="text-[13px] mt-1.5 select-text">{msg.media_caption}</p>}
        </div>
      );
    case "audio":
      return msg.media_url ? (
        <VoicePlayer
          src={msg.media_url}
          msgId={msg.id}
          time={mt(msg.created_at)}
          isMe={msg.role === "assistant"}
          status={msg.status}
        />
      ) : (
        <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-3)" }}>
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "var(--primary)" }} />
          <span>Sending voice...</span>
        </div>
      );
    case "document":
      return (
        <a
          href={msg.media_url || "#"}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl p-3 min-w-[200px] tr"
          style={{ background: "var(--primary-muted)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--primary-muted)" }}
          >
            <Sym n="description" size={20} color="var(--primary)" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate">{msg.media_filename || "Document"}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>
              {msg.media_mime_type || "File"}
            </p>
          </div>
          <Sym n="open_in_new" size={16} color="var(--text-4)" />
        </a>
      );
    case "sticker":
      return msg.media_url ? (
        <img src={msg.media_url} alt="" loading="lazy" decoding="async" className="w-[120px] h-[120px] object-contain" />
      ) : (
        <span className="text-4xl">🏷️</span>
      );
    case "location":
      return (
        <a
          href={`https://maps.google.com/?q=${msg.latitude},${msg.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl p-3 min-w-[180px] tr"
          style={{ background: "var(--primary-muted)" }}
        >
          <p className="text-[13px] font-semibold">📍 {msg.location_name || "Location"}</p>
          {msg.location_address && (
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>
              {msg.location_address}
            </p>
          )}
          <p className="text-[11px] mt-1 font-medium" style={{ color: "var(--primary)" }}>
            Open in Maps →
          </p>
        </a>
      );
    default:
      return (
        <p className="text-[13.5px] whitespace-pre-wrap break-words leading-[1.55] select-text">{msg.content}</p>
      );
  }
}

/**
 * One message bubble. Memoized so that appending a message, a delivery-receipt
 * update or a keystroke in the composer repaints only what actually changed
 * instead of every bubble on screen.
 */
export const MessageRow = memo(function MessageRow({
  msg,
  replied,
  showDate,
  peerName,
  reactPickerOpen,
  onOpenMenu,
  onReact,
  onOpenImage,
}: {
  msg: Message;
  replied: Message | null;
  showDate: boolean;
  peerName: string;
  reactPickerOpen: boolean;
  onOpenMenu: (msg: Message, anchor: { x: number; y: number; isMe: boolean }) => void;
  onReact: (msgId: string, emoji: string) => void;
  onOpenImage: (url: string) => void;
}) {
  const isMe = msg.role === "assistant";
  const isSticker = msg.message_type === "sticker";

  return (
    <div>
      {showDate && (
        <div className="flex justify-center my-4">
          <span
            className="px-4 py-1.5 rounded-full text-[11px] font-semibold"
            style={{ background: "var(--surface-1)", color: "var(--text-3)", boxShadow: "var(--shadow-sm)" }}
          >
            {dl(msg.created_at)}
          </span>
        </div>
      )}
      <div
        className={`flex ${isMe ? "justify-end" : "justify-start"} ${msg.reaction ? "mb-5" : "mb-[3px]"} group/m`}
      >
        <div className="relative max-w-[85%] sm:max-w-[65%]">
          {replied && (
            <div
              className="px-3 py-2 rounded-t-2xl text-[11px]"
              style={{
                background: isMe ? "var(--bubble-me)" : "var(--bubble-them)",
                borderLeft: "3px solid var(--primary)",
                opacity: 0.85,
              }}
            >
              <p className="font-bold text-[10px]" style={{ color: "var(--primary)" }}>
                {replied.role === "user" ? peerName : "You"}
              </p>
              <p className="truncate" style={{ color: "var(--text-3)" }}>
                {replied.content}
              </p>
            </div>
          )}
          <div
            className={`relative px-3 py-[7px] ${isSticker ? "" : replied ? "rounded-b-2xl" : "rounded-2xl"}`}
            style={
              isSticker
                ? {}
                : {
                    background: isMe ? "var(--bubble-me)" : "var(--bubble-them)",
                    color: isMe ? "var(--bubble-me-text)" : "var(--bubble-them-text)",
                    boxShadow: "var(--shadow-sm)",
                    ...(isMe && !replied
                      ? { borderTopRightRadius: "6px" }
                      : !isMe && !replied
                        ? { borderTopLeftRadius: "6px" }
                        : {}),
                  }
            }
          >
            {!msg.is_deleted && (
              <div className="absolute right-0 top-0 opacity-0 group-hover/m:opacity-100 z-10">
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    onOpenMenu(msg, { x: isMe ? rect.right : rect.left, y: rect.bottom + 4, isMe });
                  }}
                  className="w-7 h-7 rounded-bl-xl flex items-center justify-center"
                  style={{ background: isMe ? "var(--bubble-me)" : "var(--bubble-them)" }}
                >
                  <Sym n="expand_more" size={16} color="var(--text-3)" />
                </button>
              </div>
            )}
            <MessageBody msg={msg} onOpenImage={onOpenImage} />
            {msg.message_type !== "audio" && (
              <div className="flex items-center justify-end gap-0.5 mt-0.5">
                {msg.is_starred && <Sym n="star" size={12} fill color="#eab308" />}
                <span
                  className="text-[10px]"
                  style={{ color: isMe ? "var(--bubble-me-meta)" : "var(--text-4)" }}
                >
                  {mt(msg.created_at)}
                </span>
                {isMe && statusIcon(msg.status || "sent")}
              </div>
            )}
          </div>
          {msg.reaction && (
            <div
              className="absolute -bottom-3 rounded-full px-1.5 py-0.5 text-[12px] cursor-pointer hover:scale-110 tr"
              style={{
                ...(isMe ? { right: 8 } : { left: 8 }),
                background: "var(--surface-1)",
                boxShadow: "var(--shadow-md)",
                border: "1px solid var(--border)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onReact(msg.id, msg.reaction!);
              }}
            >
              {msg.reaction}
            </div>
          )}
          {reactPickerOpen && (
            <div
              data-menu
              className={`absolute ${isMe ? "right-0" : "left-0"} -top-12 z-[100] rounded-full px-2 py-1.5 flex gap-0.5 anim-scale-in`}
              style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {QUICK_REACT.map((e) => (
                <button
                  key={e}
                  onClick={() => onReact(msg.id, e)}
                  className="text-[18px] hover:scale-125 tr w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--primary-muted)]"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
