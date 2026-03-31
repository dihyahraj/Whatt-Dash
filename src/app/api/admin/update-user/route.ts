import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { id, updates } = await request.json();
  if (!id) return Response.json({ error: "ID required" }, { status: 400 });

  const supabase = getSupabase();
  const { error } = await supabase.from("allowed_users").update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
