import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { starred } = await request.json();

  // No-op writes must not fan out a Realtime event.
  const { error } = await supabase
    .from("messages")
    .update({ is_starred: starred })
    .eq("id", id)
    .neq("is_starred", starred);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ success: true });
}
