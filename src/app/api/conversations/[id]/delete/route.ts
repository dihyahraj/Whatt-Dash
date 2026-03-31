import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Delete all messages first, then the conversation
  await supabase.from("messages").delete().eq("conversation_id", id);
  const { error } = await supabase.from("conversations").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ success: true });
}
