import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

// PATCH — update a quick reply or increment usage
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const supabase = getSupabase();

  // If "use" flag, just increment usage count
  if (body.use) {
    const { error } = await supabase.rpc("increment_quick_reply_usage", { reply_id: id });
    if (error) {
      // Fallback: manual increment if RPC not available
      const { data: current } = await supabase.from("quick_replies").select("usage_count").eq("id", id).single();
      await supabase.from("quick_replies").update({ usage_count: (current?.usage_count || 0) + 1 }).eq("id", id);
    }
    return Response.json({ ok: true });
  }

  // Otherwise update fields
  const updates: Record<string, string> = {};
  if (body.title) updates.title = body.title.trim();
  if (body.content) updates.content = body.content.trim();
  if (body.category !== undefined) updates.category = body.category?.trim() || null;

  const { data, error } = await supabase
    .from("quick_replies")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

// DELETE — remove a quick reply
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabase();
  const { error } = await supabase.from("quick_replies").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
