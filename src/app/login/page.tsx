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

  // If already logged in, redirect
  if (!loading && user) { window.location.href = "/"; return null; }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError("Email and password required"); return; }
    setError(""); setBusy(true);
    const { error: err } = await signIn(email.trim(), password);
    if (err) { setError(err); setBusy(false); }
    else window.location.href = "/";
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0b141a] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b141a] flex items-center justify-center px-4" style={{ fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif" }}>
      {/* Green header bar */}
      <div className="fixed top-0 left-0 right-0 h-[200px] bg-[#00a884]"/>

      <div className="relative w-full max-w-[400px] bg-[#111b21] rounded-xl shadow-2xl shadow-black/50 overflow-hidden border border-white/[0.06]">
        {/* Header */}
        <div className="px-8 pt-10 pb-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 mb-4">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.632.632l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.379 0-4.588-.813-6.334-2.176l-.442-.352-3.17 1.063 1.063-3.17-.352-.442A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
          </div>
          <h1 className="text-[20px] font-bold text-white">Whatt Dash</h1>
          <p className="text-[13px] text-white/40 mt-1">Sign in to access the dashboard</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-8">
          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[13px] text-red-400">{error}</div>
          )}

          <div className="mb-4">
            <label className="block text-[12px] text-white/40 mb-1.5 font-medium">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com" autoComplete="email" autoFocus
              className="w-full bg-[#2a3942] rounded-lg px-4 py-3 text-[14px] text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 border border-white/[0.06]"
            />
          </div>

          <div className="mb-6">
            <label className="block text-[12px] text-white/40 mb-1.5 font-medium">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                className="w-full bg-[#2a3942] rounded-lg px-4 py-3 text-[14px] text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 border border-white/[0.06] pr-12"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-[12px]">
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={busy || !email || !password}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors text-[14px]"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Signing in...
              </span>
            ) : "Sign In"}
          </button>

          <p className="text-[11px] text-white/25 text-center mt-4">Only authorized emails can access this dashboard</p>
        </form>
      </div>
    </div>
  );
}
