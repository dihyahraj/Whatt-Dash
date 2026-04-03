import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

// GET all labels
export async function GET() {
  const sb = getSupabase();
  const { data, error } = await sb.from("labels").select("*").order("created_by_role", { ascending: true }).order("name");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data || []);
}

// POST create label
export async function POST(request: NextRequest) {
  const { name, color, created_by_email, created_by_name, created_by_role } = await request.json();
  if (!name) return Response.json({ error: "Name required" }, { status: 400 });
  const sb = getSupabase();
  const { data, error } = await sb.from("labels").insert({
    name,
    color: color || "#10b981",
    created_by_email: created_by_email || null,
    created_by_name: created_by_name || null,
    created_by_role: created_by_role || "user",
  }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
