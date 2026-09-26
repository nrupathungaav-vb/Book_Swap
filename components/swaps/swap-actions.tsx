"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, Hourglass, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { updateSwap } from "@/actions/swaps";
import { Button } from "@/components/ui/button";
import { availableSwapActions } from "@/lib/swaps/status";
import type { SwapRequest } from "@/types";

export function SwapActions({
  swap,
  userId,
  compact = false,
}: {
  swap: Pick<
    SwapRequest,
    "id" | "status" | "requester_id" | "responder_id" | "requester_completed" | "responder_completed"
  >;
  userId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const actions = availableSwapActions(swap, userId);
  const size = compact ? "sm" : "default";

  const run = (action: "accept" | "reject" | "cancel" | "complete", confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(async () => {
      const result = await updateSwap(swap.id, action);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Done.");
      router.refresh();
    });
  };

  if (
    !actions.canAccept &&
    !actions.canReject &&
    !actions.canCancel &&
    !actions.canComplete &&
    !actions.waitingForOther
  ) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.canAccept && (
        <Button size={size} variant="forest" disabled={pending} onClick={() => run("accept")}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} Accept
        </Button>
      )}
      {actions.canReject && (
        <Button size={size} variant="outline" disabled={pending} onClick={() => run("reject")}>
          <X aria-hidden /> Decline
        </Button>
      )}
      {actions.canComplete && (
        <Button
          size={size}
          disabled={pending}
          onClick={() => run("complete", "Confirm you've handed over your book and received theirs?")}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCheck aria-hidden />} We&apos;ve
          swapped
        </Button>
      )}
      {actions.waitingForOther && (
        <span className="bg-amber/15 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm">
          <Hourglass className="size-4" aria-hidden /> Waiting for the other reader to confirm
        </span>
      )}
      {actions.canCancel && (
        <Button
          size={size}
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={pending}
          onClick={() =>
            run(
              "cancel",
              swap.status === "Accepted"
                ? "Cancel this swap? Both books will become available again."
                : "Withdraw your request?",
            )
          }
        >
          {swap.status === "Accepted" ? "Cancel swap" : "Withdraw request"}
        </Button>
      )}
    </div>
  );
}
