import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabase();
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("is_archived", false)
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!conversations?.length) return Response.json([]);

  const ids = conversations.map(c => c.id);

  // Only 1 extra query: labels
  const { data: allLabels } = await supabase
    .from("conversation_labels")
    .select("conversation_id, labels(id, name, color)")
    .in("conversation_id", ids);

  const labelMap: Record<string, unknown[]> = {};
  for (const row of allLabels || []) {
    if (!row.labels) continue;
    if (!labelMap[row.conversation_id]) labelMap[row.conversation_id] = [];
    labelMap[row.conversation_id].push(row.labels);
  }

  const result = conversations.map(convo => ({
    ...convo,
    last_message: convo.last_message || null,
    last_message_type: convo.last_message_type || null,
    last_message_role: convo.last_message_role || null,
    last_message_time: convo.last_message_time || convo.updated_at,
    labels: labelMap[convo.id] || [],
  }));

  return Response.json(result);
}
