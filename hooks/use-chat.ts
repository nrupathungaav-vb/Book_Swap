"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendMessage } from "@/actions/messages";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types";

export type ChatMessage = Message & { pending?: boolean; failed?: boolean };
export type ConnectionState = "connecting" | "live" | "offline";

function sortByTime(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Realtime chat for one swap. Messages are inserted through a server action
 * (validated + RLS) and delivered to both participants via Supabase Realtime,
 * which applies the messages RLS policy per subscriber.
 */
export function useChat(swapId: string, userId: string, initialMessages: Message[]) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const seen = useRef(new Set(initialMessages.map((m) => m.id)));

  const upsert = useCallback((message: ChatMessage, replaceId?: string) => {
    setMessages((current) => {
      const withoutTemp = replaceId ? current.filter((m) => m.id !== replaceId) : current;
      if (withoutTemp.some((m) => m.id === message.id)) return withoutTemp;
      return sortByTime([...withoutTemp, message]);
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`swap-chat:${swapId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `swap_request_id=eq.${swapId}` },
        (payload) => {
          const message = payload.new as Message;
          if (seen.current.has(message.id)) return;
          seen.current.add(message.id);
          upsert(message);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnection("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnection("offline");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [swapId, upsert]);

  const send = useCallback(
    async (text: string): Promise<string | null> => {
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimistic: ChatMessage = {
        id: tempId,
        swap_request_id: swapId,
        sender_id: userId,
        text,
        created_at: new Date().toISOString(),
        pending: true,
      };
      upsert(optimistic);
      const result = await sendMessage(swapId, text);
      if (!result.ok) {
        setMessages((current) => current.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
        return result.error;
      }
      seen.current.add(result.data.id);
      upsert(result.data, tempId);
      return null;
    },
    [swapId, userId, upsert],
  );

  const discard = useCallback((id: string) => setMessages((current) => current.filter((m) => m.id !== id)), []);

  return { messages, connection, send, discard };
}
