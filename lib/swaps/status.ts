import type { SwapRequest, SwapStatus } from "@/types";

/** Mirrors public.is_valid_swap_transition() in the database. */
export const SWAP_TRANSITIONS: Readonly<Record<SwapStatus, readonly SwapStatus[]>> = {
  Pending: ["Accepted", "Rejected", "Cancelled"],
  Accepted: ["Completed", "Cancelled"],
  Rejected: [],
  Completed: [],
  Cancelled: [],
};

export function canTransitionSwap(from: SwapStatus, to: SwapStatus): boolean {
  return SWAP_TRANSITIONS[from].includes(to);
}

export function isActiveSwap(status: SwapStatus): boolean {
  return status === "Pending" || status === "Accepted";
}

export type SwapRole = "requester" | "responder";

export function swapRole(
  swap: Pick<SwapRequest, "requester_id" | "responder_id">,
  userId: string,
): SwapRole | null {
  if (swap.requester_id === userId) return "requester";
  if (swap.responder_id === userId) return "responder";
  return null;
}

/** Which actions the UI should offer this user. The database re-checks all of them. */
export function availableSwapActions(
  swap: Pick<
    SwapRequest,
    "status" | "requester_id" | "responder_id" | "requester_completed" | "responder_completed"
  >,
  userId: string,
) {
  const role = swapRole(swap, userId);
  const iConfirmed = role === "requester" ? swap.requester_completed : swap.responder_completed;
  return {
    canAccept: role === "responder" && swap.status === "Pending",
    canReject: role === "responder" && swap.status === "Pending",
    canCancel:
      (swap.status === "Pending" && role === "requester") || (swap.status === "Accepted" && role !== null),
    canComplete: swap.status === "Accepted" && role !== null && !iConfirmed,
    waitingForOther: swap.status === "Accepted" && role !== null && iConfirmed,
    canChat: role !== null && isActiveSwap(swap.status),
    canArrangeMeeting: role !== null && swap.status === "Accepted",
  };
}
