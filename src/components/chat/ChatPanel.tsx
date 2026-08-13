"use client";

import { memo, useCallback, useEffect, useState } from "react";
import type { ConversationWithLastMessage, Label, Message, QuickReply } from "@/lib/types";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { ChatAction } from "./ui";

/**
 * The right-hand chat pane. Holds chat-scoped UI state (reply draft, in-chat
 * search) so it never touches the sidebar's render path.
 */
export const ChatPanel = memo(function ChatPanel({
  convo,
  msgs,
  labels,
  quickReplies,
  isAdmin,
  isMobile,
  sending,
  hasMore,
  loadingMore,
  onLoadOlder,
  onReachedBottom,
  onSend,
  onSendFile,
  onStar,
  onReact,
  onForward,
  onAction,
  onToggleLabel,
  onBack,
  onUseQuickReply,
  onCreateQuickReply,
  onUpdateQuickReply,
  onDeleteQuickReply,
}: {
  convo: ConversationWithLastMessage;
  msgs: Message[];
  labels: Label[];
  quickReplies: QuickReply[];
  isAdmin: boolean;
  isMobile: boolean;
  sending: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadOlder: () => void;
  onReachedBottom: () => void;
  onSend: (text: string, replyTo: Message | null) => Promise<boolean>;
  onSendFile: (file: File, caption: string, forceType: string | null) => void;
  onStar: (id: string, starred: boolean) => void;
  onReact: (msgId: string, emoji: string) => void;
  onForward: (msg: Message) => void;
  onAction: (action: ChatAction, convo: ConversationWithLastMessage) => void;
  onToggleLabel: (convoId: string, labelId: string, has: boolean) => void;
  onBack: () => void;
  onUseQuickReply: (qr: QuickReply) => void;
  onCreateQuickReply: (data: { title: string; content: string; category: string | null }) => void;
  onUpdateQuickReply: (id: string, data: { title: string; content: string; category: string | null }) => void;
  onDeleteQuickReply: (id: string) => void;
}) {
  // Switching chats resets this state for free: the dashboard mounts ChatPanel
  // with key={conversation id}, so there is no reset-on-change effect to run.
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!replyTo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReplyTo(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [replyTo]);

  const send = useCallback(
    async (text: string) => {
      const reply = replyTo;
      setReplyTo(null);
      return onSend(text, reply);
    },
    [onSend, replyTo],
  );

  const cancelReply = useCallback(() => setReplyTo(null), []);

  return (
    <>
      <ChatHeader
        convo={convo}
        labels={labels}
        isAdmin={isAdmin}
        search={search}
        onSearch={setSearch}
        onBack={onBack}
        onAction={onAction}
        onToggleLabel={onToggleLabel}
      />
      <MessageList
        msgs={msgs}
        search={search}
        peerName={convo.name || convo.phone}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadOlder={onLoadOlder}
        onReachedBottom={onReachedBottom}
        onReply={setReplyTo}
        onForward={onForward}
        onStar={onStar}
        onReact={onReact}
      />
      <Composer
        peerName={convo.name}
        peerPhone={convo.phone}
        sending={sending}
        replyTo={replyTo}
        quickReplies={quickReplies}
        isMobile={isMobile}
        onCancelReply={cancelReply}
        onSend={send}
        onSendFile={onSendFile}
        onUseQuickReply={onUseQuickReply}
        onCreateQuickReply={onCreateQuickReply}
        onUpdateQuickReply={onUpdateQuickReply}
        onDeleteQuickReply={onDeleteQuickReply}
      />
    </>
  );
});
