import "server-only";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import type { Book, PublicProfile, SwapDetails, SwapRequest } from "@/types";

/** Loads swaps (RLS: only the caller's own) with both books and participants. */
export async function loadSwapDetails(supabase: TypedSupabaseClient, swaps: SwapRequest[]): Promise<SwapDetails[]> {
  if (swaps.length === 0) return [];
  const bookIds = [...new Set(swaps.flatMap((s) => [s.requested_book_id, s.offered_book_id]))];
  const userIds = [...new Set(swaps.flatMap((s) => [s.requester_id, s.responder_id]))];
  const [{ data: books }, { data: profiles }] = await Promise.all([
    supabase.from("books").select("*").in("id", bookIds),
    supabase.from("public_profiles").select("*").in("id", userIds),
  ]);
  const bookById = new Map<string, Book>((books ?? []).map((b) => [b.id, b]));
  const profileById = new Map<string, PublicProfile>((profiles ?? []).map((p) => [p.id, p]));
  const fallbackProfile = (id: string): PublicProfile => ({
    id,
    full_name: "A reader",
    avatar_url: null,
    bio: null,
    location_city: null,
    created_at: new Date(0).toISOString(),
  });

  return swaps.flatMap((swap) => {
    const requested = bookById.get(swap.requested_book_id);
    const offered = bookById.get(swap.offered_book_id);
    if (!requested || !offered) return [];
    return [
      {
        ...swap,
        requested_book: requested,
        offered_book: offered,
        requester: profileById.get(swap.requester_id) ?? fallbackProfile(swap.requester_id),
        responder: profileById.get(swap.responder_id) ?? fallbackProfile(swap.responder_id),
      },
    ];
  });
}

export async function getSwap(supabase: TypedSupabaseClient, swapId: string): Promise<SwapDetails | null> {
  const { data } = await supabase.from("swap_requests").select("*").eq("id", swapId).maybeSingle();
  if (!data) return null;
  const [details] = await loadSwapDetails(supabase, [data]);
  return details ?? null;
}
