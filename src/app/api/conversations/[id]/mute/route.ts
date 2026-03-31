import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { muted } = await request.json();

  const { error } = await supabase
    .from("conversations")
    .update({ is_muted: muted })
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ success: true });
}
