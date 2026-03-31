"use client";

import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";
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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  supabase: null,
  loading: true,
  signIn: async () => ({}),
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
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

  async function checkAllowed(sb: SupabaseClient, authUser: User): Promise<AuthUser | null> {
    try {
      const { data, error } = await sb
        .from("allowed_users")
        .select("email, display_name, role")
        .eq("email", authUser.email)
        .eq("is_active", true)
        .single();

      if (error || !data) return null;

      return {
        id: authUser.id,
        email: data.email,
        display_name: data.display_name || authUser.email?.split("@")[0] || "User",
        role: data.role as "admin" | "user",
      };
    } catch {
      return null;
    }
  }

  // On mount: check session with timeout
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    // Safety timeout — never show spinner more than 5s
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const allowed = await checkAllowed(supabase, session.user);
        if (allowed) {
          setUser(allowed);
        } else {
          await supabase.auth.signOut();
          setUser(null);
        }
      }
      clearTimeout(timeout);
      setLoading(false);
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const allowed = await checkAllowed(supabase, session.user);
        setUser(allowed);
      } else {
        setUser(null);
      }
    });

    return () => { clearTimeout(timeout); subscription.unsubscribe(); };
  }, [supabase]);

  async function signIn(email: string, password: string): Promise<{ error?: string }> {
    if (!supabase) return { error: "Supabase not configured" };

    const { data: allowedCheck } = await supabase
      .from("allowed_users")
      .select("email, is_active")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (!allowedCheck) return { error: "Access denied. Your email is not authorized." };
    if (!allowedCheck.is_active) return { error: "Your account has been deactivated." };

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return { error: "Invalid email or password." };

    if (data.user) {
      const allowed = await checkAllowed(supabase, data.user);
      if (allowed) { setUser(allowed); return {}; }
      return { error: "Access denied." };
    }

    return { error: "Login failed." };
  }

  async function signOut() {
    try {
      if (supabase) await supabase.auth.signOut();
    } catch {
      // Ignore signout errors
    }
    setUser(null);
    // Force redirect to login
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider value={{ user, supabase, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
