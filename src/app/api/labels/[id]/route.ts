import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

// PATCH — update label name/color
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = getSupabase();
  const body = await request.json();
  const updates: Record<string, string> = {};
  if (body.name) updates.name = body.name;
  if (body.color) updates.color = body.color;
  if (Object.keys(updates).length === 0) return Response.json({ error: "Nothing to update" }, { status: 400 });
  const { error } = await sb.from("labels").update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

// DELETE label with permission check
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = getSupabase();

  // Get user info from query params
  const userEmail = request.nextUrl.searchParams.get("email") || "";
  const userRole = request.nextUrl.searchParams.get("role") || "user";

  // Get the label to check ownership
  const { data: label } = await sb.from("labels").select("*").eq("id", id).single();
  if (!label) return Response.json({ error: "Label not found" }, { status: 404 });

  // Permission check:
  // - Admin can delete all labels
  // - User can only delete their own labels
  if (userRole !== "admin" && label.created_by_email !== userEmail) {
    return Response.json({ error: "Cannot delete labels created by admin" }, { status: 403 });
  }

  await sb.from("conversation_labels").delete().eq("label_id", id);
  const { error } = await sb.from("labels").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
