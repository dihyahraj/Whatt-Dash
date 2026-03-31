import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

// DELETE label
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = getSupabase();
  await sb.from("conversation_labels").delete().eq("label_id", id);
  const { error } = await sb.from("labels").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
