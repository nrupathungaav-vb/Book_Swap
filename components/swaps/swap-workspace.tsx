"use client";

import { useState } from "react";
import { MapPinned, MessageCircle } from "lucide-react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { MeetingPanel } from "@/components/map/meeting-panel";
import { cn } from "@/lib/utils";
import type { MeetingLocation, Message, PublicProfile } from "@/types";

interface WorkspaceProps {
  swapId: string;
  me: PublicProfile;
  other: PublicProfile;
  messages: Message[];
  messagesError: boolean;
  meetings: MeetingLocation[];
  canChat: boolean;
  canArrange: boolean;
  defaultCenter: { lat: number; lng: number } | null;
}

type View = "chat" | "meeting";

/**
 * Desktop (lg+): chat on the left, map on the right, side by side.
 * Mobile: a tab switcher shows one panel at a time. Each panel is mounted
 * exactly once (single realtime subscription, no duplicate ids); the inactive
 * one is only hidden with CSS so the map and chat keep their state.
 */
export function SwapWorkspace(props: WorkspaceProps) {
  const [view, setView] = useState<View>("chat");

  const tabs: { id: View; label: string; icon: typeof MessageCircle }[] = [
    { id: "chat", label: "Chat", icon: MessageCircle },
    { id: "meeting", label: "Meeting spot", icon: MapPinned },
  ];

  return (
    <div>
      <div role="tablist" aria-label="Swap workspace" className="mb-3 grid grid-cols-2 rounded-lg bg-muted p-1 lg:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={view === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setView(tab.id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium text-muted-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              view === tab.id && "bg-card text-foreground shadow-sm",
            )}
          >
            <tab.icon className="size-4" aria-hidden /> {tab.label}
          </button>
        ))}
      </div>

      <div className="gap-4 lg:grid lg:h-[calc(100dvh-16rem)] lg:min-h-[36rem] lg:grid-cols-[1.25fr_1fr]">
        <div
          id="panel-chat"
          role="tabpanel"
          aria-labelledby="tab-chat"
          className={cn("h-[70dvh] lg:block lg:h-full", view === "chat" ? "block" : "hidden")}
        >
          <ChatPanel
            swapId={props.swapId}
            me={props.me}
            other={props.other}
            initialMessages={props.messages}
            loadError={props.messagesError}
            canChat={props.canChat}
          />
        </div>
        <div
          id="panel-meeting"
          role="tabpanel"
          aria-labelledby="tab-meeting"
          className={cn("lg:block lg:h-full", view === "meeting" ? "block" : "hidden")}
        >
          <MeetingPanel
            swapId={props.swapId}
            userId={props.me.id}
            otherName={props.other.full_name ?? "the other reader"}
            initialMeetings={props.meetings}
            canArrange={props.canArrange}
            defaultCenter={props.defaultCenter}
          />
        </div>
      </div>
    </div>
  );
}
