import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

// GET — list all quick replies
export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("quick_replies")
    .select("*")
    .order("usage_count", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data || []);
}

// POST — create a new quick reply
export async function POST(request: NextRequest) {
  const { title, content, category } = await request.json();

  if (!title || !content) {
    return Response.json({ error: "Title and content required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("quick_replies")
    .insert({ title: title.trim(), content: content.trim(), category: category?.trim() || null })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
