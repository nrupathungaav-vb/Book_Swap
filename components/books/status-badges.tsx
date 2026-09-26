import { CheckCircle2, CircleDot, EyeOff, Lock, Repeat2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BookCondition, BookStatus, MatchStatus, SwapStatus } from "@/types";

const BOOK_STATUS: Record<
  BookStatus,
  { variant: "forest" | "amber" | "muted" | "secondary"; icon: typeof CheckCircle2 }
> = {
  Available: { variant: "forest", icon: CheckCircle2 },
  Reserved: { variant: "amber", icon: Lock },
  Swapped: { variant: "secondary", icon: Repeat2 },
  Hidden: { variant: "muted", icon: EyeOff },
};

/** Status is always icon + text, never color alone. */
export function BookStatusBadge({ status }: { status: BookStatus }) {
  const { variant, icon: Icon } = BOOK_STATUS[status];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden /> {status}
    </Badge>
  );
}

const CONDITION_DOTS: Record<BookCondition, number> = { New: 4, Good: 3, Fair: 2, Poor: 1 };

export function ConditionBadge({ condition }: { condition: BookCondition }) {
  const filled = CONDITION_DOTS[condition];
  return (
    <Badge variant="outline" className="gap-1.5" title={`Condition: ${condition}`}>
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={i < filled ? "bg-primary size-1.5 rounded-full" : "bg-border size-1.5 rounded-full"}
          />
        ))}
      </span>
      <span>
        <span className="sr-only">Condition: </span>
        {condition}
      </span>
    </Badge>
  );
}

const SWAP_VARIANT: Record<SwapStatus, "amber" | "forest" | "muted" | "destructive" | "secondary"> = {
  Pending: "amber",
  Accepted: "forest",
  Completed: "secondary",
  Rejected: "destructive",
  Cancelled: "muted",
};

export function SwapStatusBadge({ status }: { status: SwapStatus }) {
  return (
    <Badge variant={SWAP_VARIANT[status]}>
      <CircleDot aria-hidden /> {status}
    </Badge>
  );
}

const MATCH_LABEL: Record<MatchStatus, { label: string; variant: "forest" | "amber" | "muted" }> = {
  Open: { label: "Ready to swap", variant: "forest" },
  Pending: { label: "Request pending", variant: "amber" },
  Accepted: { label: "Swap in progress", variant: "amber" },
  Unavailable: { label: "Temporarily unavailable", variant: "muted" },
};

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const { label, variant } = MATCH_LABEL[status];
  return (
    <Badge variant={variant}>
      <CircleDot aria-hidden /> {label}
    </Badge>
  );
}
