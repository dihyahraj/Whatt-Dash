import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

// Server-side check if email is in allowed_users
// Uses service role key — bypasses RLS
export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email) return Response.json({ allowed: false });

  const supabase = getSupabase();
  const { data } = await supabase
    .from("allowed_users")
    .select("email, display_name, role, is_active")
    .eq("email", email.toLowerCase().trim())
    .eq("is_active", true)
    .single();

  if (!data) return Response.json({ allowed: false });
  return Response.json({ allowed: true, display_name: data.display_name, role: data.role });
}
