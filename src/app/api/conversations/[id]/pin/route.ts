import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { pinned } = await request.json();

  // `.neq` makes a redundant toggle a no-op: Postgres always writes a new row
  // version for an UPDATE even when nothing changed, and every write fans out a
  // Realtime event to every connected tab.
  const { error } = await supabase
    .from("conversations")
    .update({ is_pinned: pinned })
    .eq("id", id)
    .neq("is_pinned", pinned);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ success: true });
}
