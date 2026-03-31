import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

// GET labels for a conversation
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = getSupabase();
  const { data } = await sb.from("conversation_labels")
    .select("label_id, labels(id, name, color)")
    .eq("conversation_id", id);
  return Response.json(data || []);
}

// POST toggle label on conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { label_id, action } = await request.json();
  const sb = getSupabase();

  if (action === "add") {
    await sb.from("conversation_labels").insert({ conversation_id: id, label_id }).select();
  } else {
    await sb.from("conversation_labels").delete().eq("conversation_id", id).eq("label_id", label_id);
  }
  return Response.json({ success: true });
}
