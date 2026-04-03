"use client";

import { createContext, useContext, useEffect, useState, useMemo, ReactNode, useCallback } from "react";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: "admin" | "user";
}

interface AuthCtx {
  user: AuthUser | null;
  supabase: SupabaseClient | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null, supabase: null, loading: true,
  signIn: async () => ({}), signOut: () => {},
});

export function useAuth() { return useContext(AuthContext); }

async function serverCheckAllowed(email: string): Promise<{ allowed: boolean; display_name?: string; role?: string }> {
  try { const r = await fetch("/api/auth/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); return await r.json(); } catch { return { allowed: false }; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const supabase = useMemo(() => { const u = process.env.NEXT_PUBLIC_SUPABASE_URL, k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; if (!u || !k) return null; return createClient(u, k); }, []);

  const resolveUser = useCallback(async (authUser: User): Promise<AuthUser | null> => {
    const check = await serverCheckAllowed(authUser.email || "");
    if (!check.allowed) return null;
    return { id: authUser.id, email: authUser.email || "", display_name: check.display_name || authUser.email?.split("@")[0] || "User", role: (check.role as "admin" | "user") || "user" };
  }, []);

  // Restore session on mount
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    const sb = supabase;
    let cancelled = false;

    async function init() {
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          const resolved = await resolveUser(session.user);
          if (cancelled) return;
          if (resolved) setUser(resolved);
          else { await sb.auth.signOut(); setUser(null); }
        }
      } catch (e) { console.error("Auth init:", e); }
      if (!cancelled) setLoading(false);
    }

    init();
    const timeout = setTimeout(() => { if (!cancelled) setLoading(false); }, 5000);

    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (loggingOut) return;
      if (event === "SIGNED_OUT") { setUser(null); return; }
      if (session?.user) {
        const resolved = await resolveUser(session.user);
        setUser(resolved);
      }
    });

    return () => { cancelled = true; clearTimeout(timeout); subscription.unsubscribe(); };
  }, [supabase, resolveUser]);

  async function signIn(email: string, password: string): Promise<{ error?: string }> {
    if (!supabase) return { error: "Supabase not configured" };

    const check = await serverCheckAllowed(email.toLowerCase().trim());
    if (!check.allowed) return { error: "Access denied. Email not authorized." };

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Invalid email or password." };

    if (data.user) {
      const resolved = await resolveUser(data.user);
      if (resolved) { setUser(resolved); return {}; }
      return { error: "Access denied." };
    }
    return { error: "Login failed." };
  }

  function signOut() {
    if (!confirm("Are you sure you want to logout?")) return;
    setLoggingOut(true); setUser(null);
    Object.keys(localStorage).forEach(k => { if (k.startsWith("sb-")) localStorage.removeItem(k); });
    if (supabase) supabase.auth.signOut().catch(() => {});
    setTimeout(() => { window.location.replace("/login"); }, 100);
  }

  return (
    <AuthContext.Provider value={{ user, supabase, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
