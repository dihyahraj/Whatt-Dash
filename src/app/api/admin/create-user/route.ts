import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { email, password, display_name, role } = await request.json();

  if (!email || !password) return Response.json({ error: "Email and password required" }, { status: 400 });
  if (password.length < 6) return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });

  const supabase = getSupabase();

  try {
    // Create auth user (service role)
    const { error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
    });

    if (authError && !authError.message.includes("already been registered")) {
      return Response.json({ error: authError.message }, { status: 400 });
    }

    // Add to allowed_users
    const { error: insertError } = await supabase.from("allowed_users").insert({
      email: email.toLowerCase().trim(),
      display_name: display_name || null,
      role: role || "user",
      is_active: true,
    });

    if (insertError) {
      if (insertError.code === "23505") return Response.json({ error: "User already exists" }, { status: 400 });
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Create user error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
