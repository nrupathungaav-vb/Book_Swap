import Link from "next/link";
import { ArrowLeftRight, MessageCircle } from "lucide-react";
import { BookCover } from "@/components/books/book-cover";
import { SwapStatusBadge } from "@/components/books/status-badges";
import { SwapActions } from "@/components/swaps/swap-actions";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import type { SwapDetails } from "@/types";

export function SwapCard({ swap, userId }: { swap: SwapDetails; userId: string }) {
  const iAmRequester = swap.requester_id === userId;
  const other = iAmRequester ? swap.responder : swap.requester;
  const give = iAmRequester ? swap.offered_book : swap.requested_book;
  const get = iAmRequester ? swap.requested_book : swap.offered_book;

  return (
    <article className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <div className="w-16">
          <BookCover book={give} sizes="64px" />
        </div>
        <ArrowLeftRight className="size-5 text-amber" aria-label="for" />
        <div className="w-16">
          <BookCover book={get} sizes="64px" />
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <SwapStatusBadge status={swap.status} />
          <span className="text-xs text-muted-foreground">{formatRelativeTime(swap.updated_at)}</span>
        </div>
        <p className="text-sm">
          <span className="font-medium">{iAmRequester ? "You asked" : `${other.full_name ?? "A reader"} asked`}</span> to swap{" "}
          <span className="font-serif font-semibold">“{give.title}”</span> for{" "}
          <span className="font-serif font-semibold">“{get.title}”</span>
          {iAmRequester ? ` with ${other.full_name ?? "a reader"}` : ""}.
        </p>
        {swap.note && <p className="line-clamp-2 text-sm text-muted-foreground italic">“{swap.note}”</p>}
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <SwapActions swap={swap} userId={userId} compact />
        <Button asChild variant="outline" size="sm">
          <Link href={`/swaps/${swap.id}`}>
            <MessageCircle aria-hidden /> Open workspace
          </Link>
        </Button>
      </div>
    </article>
  );
}
