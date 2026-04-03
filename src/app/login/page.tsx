"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
    <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f1419] flex items-center justify-center px-4" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top gradient bar */}
      <div className="fixed top-0 left-0 right-0 h-[220px] bg-gradient-to-b from-emerald-600/80 to-emerald-700/60"/>

      <div className="relative w-full max-w-[400px] bg-[#141c24] rounded-3xl elevation-3 overflow-hidden border border-white/[0.06]">
        {/* Header */}
        <div className="px-8 pt-10 pb-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 mb-4">
            <span className="material-symbols-rounded text-white" style={{ fontSize: 30, fontVariationSettings: "'FILL' 1" }}>chat</span>
          </div>
          <h1 className="text-[20px] font-bold text-white tracking-tight">Whatt Dash</h1>
          <p className="text-[13px] text-white/40 mt-1 font-medium">Sign in to access the dashboard</p>
        </div>

        {/* Form */}
        <div className="px-8 pb-8">
          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-[13px] text-red-400 flex items-center gap-2">
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>error</span>
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-[12px] text-white/40 mb-1.5 font-medium">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com" autoComplete="email" autoFocus
              className="w-full bg-[#1e2d3a] rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 border border-white/[0.06] transition-all"
            />
          </div>

          <div className="mb-6">
            <label className="block text-[12px] text-white/40 mb-1.5 font-medium">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                className="w-full bg-[#1e2d3a] rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 border border-white/[0.06] pr-12 transition-all"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{showPw ? "visibility_off" : "visibility"}</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleSubmit} disabled={busy || !email || !password}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all text-[14px] flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <span className="material-symbols-rounded animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
                Signing in...
              </>
            ) : "Sign In"}
          </button>

          <p className="text-[11px] text-white/25 text-center mt-4 font-medium">Only authorized emails can access this dashboard</p>
        </div>
      </div>
    </div>
  );
}
