import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { unread_count } = await request.json();

  const next = unread_count ?? 1;
  // No-op writes must not fan out a Realtime event (see pin/route.ts).
  const { error } = await supabase
    .from("conversations")
    .update({ unread_count: next })
    .eq("id", id)
    .neq("unread_count", next);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ success: true });
}
