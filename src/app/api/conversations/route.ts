import { getSupabase } from "@/lib/supabase";

// Cache to reduce DB load (5 second TTL)
let cache: { data: unknown; time: number } | null = null;
const CACHE_TTL = 5000;

export async function GET() {
  // Return cached data if fresh
  if (cache && Date.now() - cache.time < CACHE_TTL) {
    return Response.json(cache.data);
  }

  const supabase = getSupabase();
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("is_archived", false)
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!conversations?.length) { cache = { data: [], time: Date.now() }; return Response.json([]); }

  const ids = conversations.map(c => c.id);

  // Batch: fetch ALL labels for all conversations in ONE query
  const { data: allLabels } = await supabase
    .from("conversation_labels")
    .select("conversation_id, labels(id, name, color)")
    .in("conversation_id", ids);

  // Group labels by conversation_id
  const labelMap: Record<string, unknown[]> = {};
  for (const row of allLabels || []) {
    if (!row.labels) continue;
    if (!labelMap[row.conversation_id]) labelMap[row.conversation_id] = [];
    labelMap[row.conversation_id].push(row.labels);
  }

  // Batch: fetch last message per conversation using RPC-style approach
  // Get recent messages ordered by created_at desc, then pick first per conversation
  const { data: recentMsgs } = await supabase
    .from("messages")
    .select("conversation_id, content, role, created_at, message_type")
    .in("conversation_id", ids)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(ids.length * 2);

  // Pick first (latest) message per conversation
  const msgMap: Record<string, { content: string; role: string; created_at: string; message_type: string }> = {};
  for (const m of recentMsgs || []) {
    if (!msgMap[m.conversation_id]) msgMap[m.conversation_id] = m;
  }

  const result = conversations.map(convo => {
    const msg = msgMap[convo.id];
    return {
      ...convo,
      last_message: msg?.content || null,
      last_message_type: msg?.message_type || null,
      last_message_role: msg?.role || null,
      last_message_time: msg?.created_at || convo.updated_at,
      labels: labelMap[convo.id] || [],
    };
  });

  cache = { data: result, time: Date.now() };
  return Response.json(result);
}
