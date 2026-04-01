import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("conversations")
    .select("phone, name, created_at, updated_at, is_archived")
    .order("name", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const header = "Name,Phone,First Contact,Last Active,Status";
  const rows = (data || []).map((c) => {
    const name = (c.name || "Unknown").replace(/,/g, " ");
    return `${name},${c.phone},${new Date(c.created_at).toLocaleDateString()},${new Date(c.updated_at).toLocaleDateString()},${c.is_archived ? "Archived" : "Active"}`;
  });

  const csv = [header, ...rows].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="whatsapp-contacts-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
