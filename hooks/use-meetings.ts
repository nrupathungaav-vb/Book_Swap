"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MeetingLocation } from "@/types";

/** Live list of meeting suggestions for a swap (RLS: participants only). */
export function useMeetings(swapId: string, initial: MeetingLocation[]) {
  const [meetings, setMeetings] = useState(initial);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`swap-meetings:${swapId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meeting_locations", filter: `swap_request_id=eq.${swapId}` },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const row = payload.new as MeetingLocation;
          setMeetings((current) => {
            const exists = current.some((m) => m.id === row.id);
            const next = exists ? current.map((m) => (m.id === row.id ? row : m)) : [row, ...current];
            return next.sort((a, b) => b.created_at.localeCompare(a.created_at));
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [swapId]);

  const upsertLocal = (row: MeetingLocation) =>
    setMeetings((current) => {
      const exists = current.some((m) => m.id === row.id);
      const next = exists ? current.map((m) => (m.id === row.id ? row : m)) : [row, ...current];
      return next.sort((a, b) => b.created_at.localeCompare(a.created_at));
    });

  return { meetings, upsertLocal };
}
