"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Sym } from "./ui";

type State = "idle" | "enrolling" | "verifying" | "enabled";

/** TOTP two-factor setup. Lazy-loaded — the enrolment flow is rarely opened. */
export default function TwoFactorModal({
  supabase,
  onClose,
}: {
  supabase: SupabaseClient | null;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  // Read the current factor list once the modal is mounted.
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void (async () => {
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        if (!alive) return;
        const verified = factors?.totp?.find((f) => f.status === "verified");
        if (verified) {
          setState("enabled");
          setFactorId(verified.id);
          return;
        }
        // Clear leftovers from an incomplete setup.
        for (const f of factors?.totp?.filter((f) => f.status !== "verified") || []) {
          await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
        }
      } catch {
        /* fall through to the disabled state */
      }
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  async function enroll() {
    if (!supabase) return;
    setError("");
    setState("enrolling");
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.totp || []) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
      }
      const { data, error: err } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Whatt Dash ${Date.now()}`,
      });
      if (err || !data) {
        setError(err?.message || "Failed to enroll");
        setState("idle");
        return;
      }
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setState("verifying");
    } catch (e) {
      setError(String(e));
      setState("idle");
    }
  }

  async function verify() {
    if (!supabase || code.length !== 6) {
      setError("Enter 6-digit code");
      return;
    }
    setError("");
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr || !challenge) {
        setError("Challenge failed");
        return;
      }
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      if (vErr) {
        setError("Invalid code. Try again.");
        setCode("");
        return;
      }
      setState("enabled");
      setCode("");
    } catch (e) {
      setError(String(e));
    }
  }

  async function disable() {
    if (!supabase || !confirm("Disable Two-Factor Authentication?")) return;
    setError("");
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId });
    if (err) {
      setError(err.message);
      return;
    }
    setState("idle");
    setFactorId("");
    setQr("");
    setSecret("");
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "var(--bg-overlay)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-[380px] max-h-[90vh] flex flex-col anim-scale-in"
        style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-4 py-3 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Sym n="security" size={20} color="var(--primary)" />
            <h3 className="text-[15px] font-bold" style={{ color: "var(--text-1)" }}>
              Two-Factor Auth
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center tr hover:bg-[var(--surface-3)]"
            style={{ color: "var(--text-3)" }}
          >
            <Sym n="close" size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4">
          {error && (
            <div
              className="mb-3 px-3 py-2.5 rounded-xl text-[12px] font-medium flex items-center gap-2"
              style={{ background: "var(--danger-muted)", color: "var(--danger)" }}
            >
              <Sym n="error" size={16} />
              {error}
            </div>
          )}

          {state === "idle" && (
            <div className="text-center py-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "var(--surface-3)" }}
              >
                <Sym n="shield" size={28} color="var(--text-4)" />
              </div>
              <p className="text-[14px] font-bold mb-1" style={{ color: "var(--text-1)" }}>
                2FA is disabled
              </p>
              <p className="text-[12px] mb-4" style={{ color: "var(--text-3)" }}>
                Add extra security using an authenticator app
              </p>
              <button
                onClick={enroll}
                className="w-full font-bold py-2.5 rounded-xl text-[13px] flex items-center justify-center gap-2 tr"
                style={{ background: "var(--primary)", color: "var(--primary-text)" }}
              >
                <Sym n="qr_code_2" size={18} />
                Enable 2FA
              </button>
            </div>
          )}

          {state === "enrolling" && (
            <div className="text-center py-6">
              <div
                className="w-5 h-5 border-2 rounded-full animate-spin mx-auto mb-2"
                style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
              />
              <p className="text-[12px]" style={{ color: "var(--text-3)" }}>
                Generating QR code...
              </p>
            </div>
          )}

          {state === "verifying" && (
            <div>
              <p className="text-[13px] font-bold text-center mb-0.5" style={{ color: "var(--text-1)" }}>
                Scan this QR code
              </p>
              <p className="text-[11px] text-center mb-3" style={{ color: "var(--text-3)" }}>
                Google Authenticator → + → Scan
              </p>
              <div className="flex justify-center mb-3">
                <div className="p-2 rounded-xl" style={{ background: "#fff" }}>
                  <img src={qr} alt="QR" className="w-[140px] h-[140px]" />
                </div>
              </div>
              <p className="text-[10px] font-semibold mb-1 tracking-wide" style={{ color: "var(--text-4)" }}>
                OR ENTER MANUALLY
              </p>
              <div
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 mb-3"
                style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
              >
                <code
                  className="flex-1 text-[11px] font-mono font-bold tracking-wider"
                  style={{ color: "var(--primary)", wordBreak: "break-all" }}
                >
                  {secret}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(secret)}
                  className="w-7 h-7 rounded-md flex items-center justify-center tr"
                  style={{ color: "var(--primary)" }}
                >
                  <Sym n="content_copy" size={16} />
                </button>
              </div>
              <p className="text-[10px] font-semibold mb-1.5 tracking-wide" style={{ color: "var(--text-4)" }}>
                VERIFY CODE
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  if (/^\d*$/.test(e.target.value)) setCode(e.target.value);
                }}
                placeholder="000000"
                className="w-full rounded-lg px-3 py-2.5 text-[18px] font-bold tracking-[0.3em] text-center focus:outline-none tr mb-3"
                style={{ background: "var(--surface-3)", color: "var(--text-1)", border: "1.5px solid var(--border)" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--border-focus)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                onKeyDown={(e) => e.key === "Enter" && verify()}
              />
              <button
                onClick={verify}
                disabled={code.length !== 6}
                className="w-full font-bold py-2.5 rounded-xl text-[13px] flex items-center justify-center gap-2 tr disabled:opacity-40"
                style={{ background: "var(--primary)", color: "var(--primary-text)" }}
              >
                <Sym n="verified_user" size={16} />
                Verify &amp; Enable
              </button>
            </div>
          )}

          {state === "enabled" && (
            <div className="text-center py-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "var(--primary-muted)" }}
              >
                <Sym n="verified_user" size={28} fill color="var(--primary)" />
              </div>
              <p className="text-[14px] font-bold mb-1" style={{ color: "var(--text-1)" }}>
                2FA is enabled
              </p>
              <p className="text-[12px] mb-4" style={{ color: "var(--text-3)" }}>
                Your account is protected
              </p>
              <button
                onClick={disable}
                className="w-full font-bold py-2.5 rounded-xl text-[13px] flex items-center justify-center gap-2 tr"
                style={{ background: "var(--danger-muted)", color: "var(--danger)" }}
              >
                <Sym n="shield" size={16} />
                Disable 2FA
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
