import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { archived } = await request.json();

  // No-op toggles must not write (see the note in pin/route.ts).
  const { error } = await supabase
    .from("conversations")
    .update({ is_archived: archived })
    .eq("id", id)
    .neq("is_archived", archived);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ success: true });
}
