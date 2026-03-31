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

// Server-side check (bypasses RLS completely)
async function serverCheckAllowed(email: string): Promise<{ allowed: boolean; display_name?: string; role?: string }> {
  try {
    const r = await fetch("/api/auth/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return await r.json();
  } catch {
    return { allowed: false };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
  }, []);

  const resolveUser = useCallback(async (authUser: User): Promise<AuthUser | null> => {
    const check = await serverCheckAllowed(authUser.email || "");
    if (!check.allowed) return null;
    return {
      id: authUser.id,
      email: authUser.email || "",
      display_name: check.display_name || authUser.email?.split("@")[0] || "User",
      role: (check.role as "admin" | "user") || "user",
    };
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

    // Check via server API (no RLS issue)
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
    if (!confirm("Logout karna hai?")) return;
    setUser(null);
    // Clear Supabase session completely
    if (supabase) {
      supabase.auth.signOut().then(() => {
        // Also clear any localStorage tokens manually
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith("sb-")) localStorage.removeItem(k);
        });
        window.location.replace("/login");
      });
    } else {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("sb-")) localStorage.removeItem(k);
      });
      window.location.replace("/login");
    }
  }

  return (
    <AuthContext.Provider value={{ user, supabase, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
