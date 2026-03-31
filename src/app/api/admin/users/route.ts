import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabase(); // service role key — bypasses RLS
  const { data, error } = await supabase
    .from("allowed_users")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data || []);
}
