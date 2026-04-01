import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = getSupabase();
  const { data } = await sb.from("conversations").select("phone, name").eq("id", id).single();
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });

  const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${data.name || data.phone}
TEL;TYPE=CELL:+${data.phone}
END:VCARD`;

  return new Response(vcard, {
    headers: {
      "Content-Type": "text/vcard",
      "Content-Disposition": `attachment; filename="${(data.name || data.phone).replace(/[^a-zA-Z0-9]/g, "_")}.vcf"`,
    },
  });
}
