import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

// Server-side check if email is in allowed_users
// Uses service role key — bypasses RLS
// reason: "not_allowed" = email genuinely not in the list; "server_error" = DB/env failure, NOT an auth verdict
export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email) return Response.json({ allowed: false, reason: "not_allowed" });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || (!process.env.SUPABASE_INTERNAL_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    console.error("[auth/check] Supabase env vars missing (SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL)");
    return Response.json({ allowed: false, reason: "server_error" });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("allowed_users")
      .select("email, display_name, role, is_active")
      .eq("email", email.toLowerCase().trim())
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("[auth/check] allowed_users query failed:", error.code, error.message);
      return Response.json({ allowed: false, reason: "server_error" });
    }
    if (!data) return Response.json({ allowed: false, reason: "not_allowed" });
    return Response.json({ allowed: true, display_name: data.display_name, role: data.role });
  } catch (e) {
    console.error("[auth/check] Supabase unreachable:", e instanceof Error ? e.message : e);
    return Response.json({ allowed: false, reason: "server_error" });
  }
}

// Diagnostic: open /api/auth/check in a browser to see why logins fail.
// Reports env var presence (booleans only) and whether the allowed_users query works.
export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_INTERNAL_URL: !!process.env.SUPABASE_INTERNAL_URL,
  };
  if (!env.SUPABASE_SERVICE_ROLE_KEY || (!env.SUPABASE_INTERNAL_URL && !env.NEXT_PUBLIC_SUPABASE_URL)) {
    return Response.json({ ok: false, problem: "Missing Supabase environment variables", env });
  }
  try {
    const { count, error } = await getSupabase()
      .from("allowed_users")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);
    if (error) {
      return Response.json({ ok: false, problem: `allowed_users query failed: ${error.message}`, code: error.code, env });
    }
    return Response.json({ ok: true, active_allowed_users: count, env });
  } catch (e) {
    return Response.json({ ok: false, problem: `Supabase unreachable: ${e instanceof Error ? e.message : String(e)}`, env });
  }
}
