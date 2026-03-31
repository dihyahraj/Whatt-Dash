import { supabase } from "@/lib/supabase";

export async function GET() {
  // Get all non-archived conversations, pinned first, then by updated_at
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("is_archived", false)
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Fetch last message for each conversation
  const withLastMessage = await Promise.all(
    (conversations || []).map(async (convo) => {
      const { data: messages } = await supabase
        .from("messages")
        .select("content, role, created_at, message_type")
        .eq("conversation_id", convo.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(1);

      return {
        ...convo,
        last_message: messages?.[0]?.content || null,
        last_message_type: messages?.[0]?.message_type || null,
        last_message_role: messages?.[0]?.role || null,
        last_message_time: messages?.[0]?.created_at || convo.updated_at,
      };
    })
  );

  return Response.json(withLastMessage);
}
