"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { friendlyDbError, toActionError } from "@/lib/utils/errors";
import { swapActionSchema, swapRequestSchema, type SwapRequestInput } from "@/lib/validations/swap";
import type { ActionResult, SwapStatus } from "@/types";

function revalidateSwaps(swapId?: string) {
  revalidatePath("/swaps");
  revalidatePath("/matches");
  revalidatePath("/discover");
  revalidatePath("/books");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  if (swapId) revalidatePath(`/swaps/${swapId}`);
}

export async function createSwapRequest(input: SwapRequestInput): Promise<ActionResult<{ id: string }>> {
  const parsed = swapRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const { supabase } = await requireUser();
    // Ownership, availability and duplicate checks happen atomically in Postgres.
    const { data, error } = await supabase.rpc("create_swap_request", {
      p_requested_book_id: parsed.data.requestedBookId,
      p_offered_book_id: parsed.data.offeredBookId,
      p_note: parsed.data.note,
    });
    if (error || !data)
      return { ok: false, error: friendlyDbError(error, "Your swap request couldn't be sent.") };
    revalidateSwaps(data);
    return { ok: true, data: { id: data }, message: "Swap request sent!" };
  } catch (error) {
    return toActionError(error);
  }
}

const RPC_BY_ACTION = {
  accept: "accept_swap_request",
  reject: "reject_swap_request",
  cancel: "cancel_swap_request",
  complete: "complete_swap",
} as const;

const SUCCESS_MESSAGE: Record<keyof typeof RPC_BY_ACTION, string> = {
  accept: "Swap accepted — both books are now reserved.",
  reject: "Request declined.",
  cancel: "Swap cancelled. Reserved books are available again.",
  complete: "Thanks for confirming!",
};

export async function updateSwap(
  swapId: string,
  action: keyof typeof RPC_BY_ACTION,
): Promise<ActionResult<{ status: SwapStatus }>> {
  const parsed = swapActionSchema.safeParse({ swapId, action });
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc(RPC_BY_ACTION[parsed.data.action], {
      p_swap_id: parsed.data.swapId,
    });
    if (error || !data)
      return { ok: false, error: friendlyDbError(error, "That didn't work. Please refresh and try again.") };
    revalidateSwaps(parsed.data.swapId);
    const message =
      parsed.data.action === "complete" && data.status === "Completed"
        ? "Swap completed. Enjoy your new book!"
        : parsed.data.action === "complete"
          ? "Marked as exchanged — waiting for the other reader to confirm."
          : SUCCESS_MESSAGE[parsed.data.action];
    return { ok: true, data: { status: data.status }, message };
  } catch (error) {
    return toActionError(error);
  }
}
