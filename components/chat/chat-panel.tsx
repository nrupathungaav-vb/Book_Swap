"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, MessageCircle, RotateCcw, Send, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChat, type ChatMessage } from "@/hooks/use-chat";
import { cn, formatTime, initials } from "@/lib/utils";
import type { Message, PublicProfile } from "@/types";

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}

export function ChatPanel({
  swapId,
  me,
  other,
  initialMessages,
  loadError,
  canChat,
}: {
  swapId: string;
  me: PublicProfile;
  other: PublicProfile;
  initialMessages: Message[];
  loadError: boolean;
  canChat: boolean;
}) {
  const { messages, connection, send, discard } = useChat(swapId, me.id, initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setDraft("");
    const error = await send(trimmed);
    setSending(false);
    if (error) toast.error(error);
  };

  const retry = async (message: ChatMessage) => {
    discard(message.id);
    await submit(message.text);
  };

  let lastDay = "";

  return (
    <section
      aria-labelledby="chat-heading"
      className="bg-card flex h-full min-h-[28rem] flex-col overflow-hidden rounded-2xl border shadow-sm"
    >
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Avatar className="size-8">
          {other.avatar_url && <AvatarImage src={other.avatar_url} alt="" />}
          <AvatarFallback>{initials(other.full_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 id="chat-heading" className="truncate font-sans text-sm font-semibold">
            Chat with {other.full_name ?? "a reader"}
          </h2>
          <p className="text-muted-foreground flex items-center gap-1 text-xs" aria-live="polite">
            {connection === "live" ? (
              <>
                <Wifi className="text-forest size-3" aria-hidden /> Live
              </>
            ) : connection === "connecting" ? (
              <>
                <Loader2 className="size-3 animate-spin" aria-hidden /> Connecting…
              </>
            ) : (
              <>
                <WifiOff className="text-destructive size-3" aria-hidden /> Offline — new messages will appear
                when you reconnect
              </>
            )}
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-label="Messages"
      >
        {loadError && (
          <p className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg p-3 text-sm">
            <AlertCircle className="size-4" aria-hidden /> Unable to load messages. Refresh to try again.
          </p>
        )}
        {!loadError && messages.length === 0 && (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 py-10 text-center text-sm">
            <MessageCircle className="text-primary/60 size-8" aria-hidden />
            <p>No messages yet. Say hello and suggest when you&apos;re free!</p>
          </div>
        )}
        {messages.map((message) => {
          const mine = message.sender_id === me.id;
          const day = dayLabel(message.created_at);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={message.id}>
              {showDay && <p className="text-muted-foreground my-3 text-center text-xs font-medium">{day}</p>}
              <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-xs",
                    mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm",
                    message.pending && "opacity-70",
                    message.failed && "border-destructive bg-destructive/10 text-foreground border",
                  )}
                >
                  <span className="sr-only">{mine ? "You" : (other.full_name ?? "They")} said: </span>
                  <p className="break-words whitespace-pre-wrap">{message.text}</p>
                  <p
                    className={cn(
                      "mt-0.5 text-right text-[10px]",
                      mine ? "text-primary-foreground/75" : "text-muted-foreground",
                    )}
                  >
                    {message.failed
                      ? "Not sent"
                      : message.pending
                        ? "Sending…"
                        : formatTime(message.created_at)}
                  </p>
                </div>
              </div>
              {message.failed && (
                <div className="mt-1 flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => void retry(message)}>
                    <RotateCcw aria-hidden /> Retry
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {canChat ? (
        <form
          className="flex items-end gap-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(draft);
          }}
        >
          <label htmlFor={`chat-input-${swapId}`} className="sr-only">
            Message
          </label>
          <Textarea
            id={`chat-input-${swapId}`}
            rows={1}
            value={draft}
            maxLength={2000}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit(draft);
              }
            }}
            placeholder="Write a message…"
            className="max-h-32 min-h-10 resize-none"
          />
          <Button type="submit" size="icon" disabled={!draft.trim() || sending} aria-label="Send message">
            {sending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          </Button>
        </form>
      ) : (
        <p className="text-muted-foreground border-t p-3 text-center text-sm">
          This swap is closed, so the chat is read-only.
        </p>
      )}
    </section>
  );
}
