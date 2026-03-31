import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

// GET all labels
export async function GET() {
  const sb = getSupabase();
  const { data, error } = await sb.from("labels").select("*").order("name");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data || []);
}

// POST create label
export async function POST(request: NextRequest) {
  const { name, color } = await request.json();
  if (!name) return Response.json({ error: "Name required" }, { status: 400 });
  const sb = getSupabase();
  const { data, error } = await sb.from("labels").insert({ name, color: color || "#10b981" }).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
