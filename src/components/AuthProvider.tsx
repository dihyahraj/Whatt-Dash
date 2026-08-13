"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
// Type-only import: erased at build time, so it pulls nothing into the bundle.
import type { SupabaseClient, User } from "@supabase/supabase-js";

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CONFIGURED = !!(SUPABASE_URL && SUPABASE_KEY);

/**
 * supabase-js is ~140 KB of parsed JavaScript and nothing on the first paint
 * needs it: the shell, the sidebar skeleton and the conversation fetch (which
 * goes through our own API routes) are all independent of it. Importing it
 * dynamically keeps it out of the entry chunk, so hydration isn't stuck behind
 * parsing an auth + realtime + postgrest + storage client.
 *
 * One module-level promise, so every caller shares a single client instance.
 */
let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!CONFIGURED) return Promise.resolve(null);
  clientPromise ||= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE_URL!, SUPABASE_KEY!),
  );
  return clientPromise;
}

async function serverCheckAllowed(email: string): Promise<{ allowed: boolean; reason?: string; display_name?: string; role?: string }> {
  try { const r = await fetch("/api/auth/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); return await r.json(); } catch { return { allowed: false, reason: "server_error" }; }
}

/**
 * Stale-while-revalidate for the allow-list check.
 *
 * Restoring a session used to block the whole dashboard on a round trip to
 * /api/auth/check, which itself queries `allowed_users` — a serial network +
 * database hop on every single page load, for data that changes maybe once a
 * month. The cached answer renders immediately and the network check still runs,
 * demoting or signing the user out if it disagrees.
 *
 * This is a UX gate, not a security boundary — the API routes are what must
 * enforce access — so trusting a local copy for a few hundred milliseconds does
 * not widen anything.
 */
const PROFILE_KEY = "wd-profile";
const PROFILE_TTL = 12 * 60 * 60 * 1000;

type CachedProfile = { email: string; display_name: string; role: "admin" | "user"; at: number };

function readCachedProfile(email: string): CachedProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CachedProfile;
    if (p?.email !== email || !p.at || Date.now() - p.at > PROFILE_TTL) return null;
    return p;
  } catch {
    return null;
  }
}

function writeCachedProfile(p: Omit<CachedProfile, "at">) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...p, at: Date.now() }));
  } catch {
    /* private mode / quota */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  // Without a configured client there is no session to restore, so we are not
  // "loading" at all — deciding that here avoids a setState during the effect.
  const [loading, setLoading] = useState(CONFIGURED);
  const [loggingOut, setLoggingOut] = useState(false);

  // Fetch the client chunk as soon as we're interactive; the shell has already
  // painted by then.
  useEffect(() => {
    let alive = true;
    void getSupabaseClient().then((client) => {
      if (alive) setSupabase(client);
    });
    return () => {
      alive = false;
    };
  }, []);

  const resolveUser = useCallback(async (authUser: User): Promise<{ user: AuthUser | null; serverError: boolean }> => {
    const email = authUser.email || "";
    const check = await serverCheckAllowed(email);
    if (!check.allowed) {
      // Revoked or demoted: drop the local copy so it can't paint again.
      if (check.reason !== "server_error") localStorage.removeItem(PROFILE_KEY);
      return { user: null, serverError: check.reason === "server_error" };
    }
    const display_name = check.display_name || email.split("@")[0] || "User";
    const role = (check.role as "admin" | "user") || "user";
    writeCachedProfile({ email, display_name, role });
    return { user: { id: authUser.id, email, display_name, role }, serverError: false };
  }, []);

  // Restore session on mount
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    let cancelled = false;

    async function init() {
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          // Paint from the cached profile first; the check below still runs.
          const cached = readCachedProfile(session.user.email || "");
          if (cached) {
            setUser({
              id: session.user.id,
              email: cached.email,
              display_name: cached.display_name,
              role: cached.role,
            });
            setLoading(false);
          }
          const { user: resolved, serverError } = await resolveUser(session.user);
          if (cancelled) return;
          if (resolved) setUser(resolved);
          // Only destroy the session when the email is genuinely not allowed —
          // a server/DB failure is transient; keep the session so login survives recovery
          else if (!serverError) { await sb.auth.signOut(); setUser(null); }
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
        const { user: resolved, serverError } = await resolveUser(session.user);
        if (resolved) setUser(resolved);
        else if (!serverError) setUser(null);
      }
    });

    return () => { cancelled = true; clearTimeout(timeout); subscription.unsubscribe(); };
  }, [supabase, resolveUser]);

  async function signIn(email: string, password: string): Promise<{ error?: string }> {
    // Awaits the client rather than reading state, so a submit that lands before
    // the chunk has loaded still works.
    const client = await getSupabaseClient();
    if (!client) return { error: "Supabase not configured" };

    const check = await serverCheckAllowed(email.toLowerCase().trim());
    if (!check.allowed) {
      if (check.reason === "server_error") return { error: "Server error — database not reachable. Open /api/auth/check for details." };
      return { error: "Access denied. Email not authorized." };
    }

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { error: "Invalid email or password." };

    if (data.user) {
      const { user: resolved, serverError } = await resolveUser(data.user);
      if (resolved) { setUser(resolved); return {}; }
      if (serverError) return { error: "Server error — database not reachable. Open /api/auth/check for details." };
      return { error: "Access denied." };
    }
    return { error: "Login failed." };
  }

  function signOut() {
    if (!confirm("Are you sure you want to logout?")) return;
    setLoggingOut(true); setUser(null);
    Object.keys(localStorage).forEach(k => { if (k.startsWith("sb-")) localStorage.removeItem(k); });
    localStorage.removeItem(PROFILE_KEY);
    void getSupabaseClient().then((client) => client?.auth.signOut().catch(() => {}));
    setTimeout(() => { window.location.replace("/login"); }, 100);
  }

  return (
    <AuthContext.Provider value={{ user, supabase, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
