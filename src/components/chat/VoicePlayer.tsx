"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Sym } from "./ui";

const BARS = 44; // 44 * (3 + 1.5) = 198px — fits the 204px slot without scaling the strokes
const BAR_W = 3;
const BAR_GAP = 1.5;
const MIN_BAR_H = 4;
const WAVE_W = BARS * (BAR_W + BAR_GAP);
const WAVE_H = 30;

/** Waveform-style audio player for voice notes. */
export const VoicePlayer = memo(function VoicePlayer({
  src,
  msgId,
  time,
  isMe,
  status,
}: {
  src: string;
  msgId: string;
  time?: string;
  isMe?: boolean;
  status?: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrent] = useState(0);

  /**
   * The waveform is ONE svg path instead of 48 <div> bars. A chat with 20 voice
   * notes was worth ~1,000 DOM nodes on its own; this makes it ~4 per player.
   * Same deterministic pseudo-random shape as before, derived from the message id.
   */
  const barPath = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < msgId.length; i++) seed = ((seed << 5) - seed + msgId.charCodeAt(i)) | 0;
    let prev = 0.4;
    let d = "";
    for (let i = 0; i < BARS; i++) {
      seed = (seed * 16807 + 12345) & 0x7fffffff;
      const raw = (seed % 100) / 100;
      const h = 0.18 + (raw * 0.4 + prev * 0.6) * 0.82;
      prev = h;
      const x = BAR_GAP / 2 + i * (BAR_W + BAR_GAP) + BAR_W / 2;
      const barH = Math.max(h * WAVE_H, MIN_BAR_H);
      // Bottom-aligned bar, drawn as a single round-capped vertical stroke.
      d += `M${x.toFixed(2)} ${(WAVE_H - BAR_W / 2).toFixed(2)}V${Math.max(WAVE_H - barH + BAR_W / 2, BAR_W / 2).toFixed(2)}`;
    }
    return d;
  }, [msgId]);

  const clipId = `wave-${msgId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      setCurrent(a.currentTime);
      setProgress(a.duration ? a.currentTime / a.duration : 0);
    };
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setCurrent(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play().catch(() => {});
    setPlaying(!playing);
  }

  function seek(e: React.MouseEvent<SVGSVGElement>) {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    a.currentTime = p * a.duration;
    setProgress(p);
  }

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3" style={{ width: 260 }}>
      {/* preload="none": a chat full of voice notes used to fire a metadata
          request for every single one the moment it rendered. */}
      <audio ref={audioRef} src={src} preload="none" />
      <button
        onClick={toggle}
        className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--primary)", boxShadow: "0 2px 10px var(--primary-glow)" }}
      >
        <Sym n={playing ? "pause" : "play_arrow"} size={24} fill color="var(--primary-text)" />
      </button>
      <div className="flex-1 min-w-0">
        <svg
          width={WAVE_W}
          height={WAVE_H}
          viewBox={`0 0 ${WAVE_W} ${WAVE_H}`}
          className="cursor-pointer block"
          onClick={seek}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width={Math.max(progress, 0) * WAVE_W} height={WAVE_H} />
            </clipPath>
          </defs>
          <path
            d={barPath}
            stroke="var(--text-4)"
            strokeWidth={BAR_W}
            strokeLinecap="round"
            opacity="0.3"
            fill="none"
          />
          <path
            d={barPath}
            stroke="var(--primary)"
            strokeWidth={BAR_W}
            strokeLinecap="round"
            fill="none"
            clipPath={`url(#${clipId})`}
          />
        </svg>
        <div className="flex items-center justify-between mt-1">
          <span
            className="text-[10px] font-semibold tabular-nums"
            style={{ color: playing ? "var(--primary)" : "var(--text-3)" }}
          >
            {playing ? fmt(currentTime) : fmt(duration)}
          </span>
          {time && (
            <div className="flex items-center gap-0.5">
              <span className="text-[10px]" style={{ color: isMe ? "var(--bubble-me-meta)" : "var(--text-4)" }}>
                {time}
              </span>
              {isMe && status === "sent" && <Sym n="check" size={14} color="var(--bubble-me-meta)" />}
              {isMe && status === "delivered" && <Sym n="done_all" size={14} color="var(--bubble-me-meta)" />}
              {isMe && status === "read" && <Sym n="done_all" size={14} color="#53bdeb" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
