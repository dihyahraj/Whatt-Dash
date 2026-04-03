"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Apply theme
  useEffect(() => {
    const t = (localStorage.getItem("wd-theme") as string) || "dark";
    if (t === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    } else {
      document.documentElement.setAttribute("data-theme", t);
    }
  }, []);

  const hasSession = typeof window !== "undefined" && Object.keys(localStorage).some((k) => k.startsWith("sb-"));
  if (!loading && user && hasSession) { window.location.href = "/"; return null; }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError("Email and password required"); return; }
    setError(""); setBusy(true);
    const { error: err } = await signIn(email.trim(), password);
    if (err) { setError(err); setBusy(false); }
    else window.location.href = "/";
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--primary)" }}>
          <span className="material-symbols-rounded text-white" style={{ fontSize: 28, fontVariationSettings: "'FILL' 1" }}>chat</span>
        </div>
        <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}/>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "var(--bg)" }}>

      {/* ── Animated Background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute -top-[30%] -left-[10%] w-[600px] h-[600px] rounded-full opacity-[0.15]" style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)", animation: "float1 20s ease-in-out infinite" }}/>
        <div className="absolute -bottom-[20%] -right-[10%] w-[500px] h-[500px] rounded-full opacity-[0.1]" style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)", animation: "float2 25s ease-in-out infinite" }}/>
        <div className="absolute top-[20%] right-[20%] w-[300px] h-[300px] rounded-full opacity-[0.08]" style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)", animation: "float3 18s ease-in-out infinite" }}/>
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(var(--text-4) 1px, transparent 1px), linear-gradient(90deg, var(--text-4) 1px, transparent 1px)", backgroundSize: "60px 60px" }}/>
      </div>

      {/* ── Login Card ── */}
      <div className={`relative w-full max-w-[420px] transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>

        {/* Card */}
        <div className="rounded-3xl overflow-hidden" style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)", backdropFilter: "blur(20px)" }}>

          {/* Top accent line */}
          <div className="h-1" style={{ background: "linear-gradient(90deg, var(--primary), var(--primary-soft), #3b82f6)" }}/>

          {/* Header */}
          <div className="px-8 pt-10 pb-2 text-center">
            <div className="relative inline-flex">
              <div className="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center mx-auto" style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-soft))", boxShadow: "0 8px 32px var(--primary-glow)" }}>
                <span className="material-symbols-rounded text-white" style={{ fontSize: 34, fontVariationSettings: "'FILL' 1" }}>chat</span>
              </div>
              {/* Online dot */}
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "var(--surface-1)" }}>
                <div className="w-3 h-3 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e80" }}/>
              </div>
            </div>
            <h1 className="text-[24px] font-extrabold tracking-tight mt-5" style={{ color: "var(--text-1)" }}>Whatt Dash</h1>
            <p className="text-[13px] mt-1.5 font-medium" style={{ color: "var(--text-3)" }}>Sign in to your dashboard</p>
          </div>

          {/* Form */}
          <div className="px-8 pt-6 pb-8">
            {/* Error */}
            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl text-[13px] font-medium flex items-center gap-2.5" style={{ background: "var(--danger-muted)", color: "var(--danger)", border: "1px solid rgba(225,29,72,0.15)" }}>
                <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 18 }}>error</span>
                {error}
              </div>
            )}

            {/* Email */}
            <div className="mb-4">
              <label className="block text-[12px] font-semibold mb-2 tracking-wide" style={{ color: "var(--text-3)" }}>EMAIL</label>
              <div className="relative">
                <span className="material-symbols-rounded absolute left-3.5 top-1/2 -translate-y-1/2" style={{ fontSize: 20, color: "var(--text-4)" }}>mail</span>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" autoComplete="email" autoFocus
                  className="w-full rounded-xl pl-11 pr-4 py-3.5 text-[14px] focus:outline-none tr"
                  style={{ background: "var(--surface-3)", color: "var(--text-1)", border: "1.5px solid var(--border)" }}
                  onFocus={e => e.target.style.borderColor = "var(--border-focus)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"}
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-6">
              <label className="block text-[12px] font-semibold mb-2 tracking-wide" style={{ color: "var(--text-3)" }}>PASSWORD</label>
              <div className="relative">
                <span className="material-symbols-rounded absolute left-3.5 top-1/2 -translate-y-1/2" style={{ fontSize: 20, color: "var(--text-4)" }}>lock</span>
                <input
                  type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  className="w-full rounded-xl pl-11 pr-12 py-3.5 text-[14px] focus:outline-none tr"
                  style={{ background: "var(--surface-3)", color: "var(--text-1)", border: "1.5px solid var(--border)" }}
                  onFocus={e => e.target.style.borderColor = "var(--border-focus)"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"}
                  onKeyDown={e => e.key === "Enter" && handleSubmit(e)}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center tr" style={{ color: "var(--text-4)" }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 20 }}>{showPw ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit} disabled={busy || !email || !password}
              className="w-full font-bold py-3.5 rounded-xl text-[14px] flex items-center justify-center gap-2 tr disabled:opacity-40 disabled:cursor-not-allowed group"
              style={{ background: "var(--primary)", color: "var(--primary-text)", boxShadow: !busy && email && password ? "0 4px 20px var(--primary-glow)" : "none" }}
            >
              {busy ? (
                <><span className="material-symbols-rounded animate-spin" style={{ fontSize: 18 }}>progress_activity</span>Signing in...</>
              ) : (
                <><span className="material-symbols-rounded" style={{ fontSize: 18 }}>login</span>Sign In</>
              )}
            </button>

            {/* Footer */}
            <div className="flex items-center gap-2 justify-center mt-5">
              <span className="material-symbols-rounded" style={{ fontSize: 14, color: "var(--text-4)" }}>shield</span>
              <p className="text-[11px] font-medium" style={{ color: "var(--text-4)" }}>Authorized access only</p>
            </div>
          </div>
        </div>

        {/* Bottom branding */}
        <div className="text-center mt-5">
          <p className="text-[11px] font-medium" style={{ color: "var(--text-4)" }}>Powered by <span style={{ color: "var(--primary)" }}>Bio Shop™</span></p>
        </div>
      </div>

      {/* Keyframe animations for background orbs */}
      <style jsx>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 20px) scale(1.1); }
          66% { transform: translate(30px, -30px) scale(0.9); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-30px, 30px); }
        }
      `}</style>
    </div>
  );
}
