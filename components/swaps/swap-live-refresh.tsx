"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Refreshes server data when the other participant changes the swap's status. */
export function SwapLiveRefresh({ swapId }: { swapId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`swap-status:${swapId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "swap_requests", filter: `id=eq.${swapId}` },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [swapId, router]);
  return null;
}
