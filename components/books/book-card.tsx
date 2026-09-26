import Link from "next/link";
import { MapPin, Sparkles } from "lucide-react";
import { AiInsightsButton } from "@/components/books/ai-insights-sheet";
import { BookCover } from "@/components/books/book-cover";
import { ConditionBadge, BookStatusBadge } from "@/components/books/status-badges";
import { RequestSwapButton } from "@/components/swaps/request-swap-dialog";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { Badge } from "@/components/ui/badge";
import { formatDistance } from "@/lib/utils";
import type { BookCondition, BookStatus } from "@/types";

export interface BookCardData {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  condition: BookCondition;
  status: BookStatus;
  cover_image_url: string | null;
  google_cover_url: string | null;
  owner_name?: string | null;
  owner_city?: string | null;
  distance_km?: number | null;
  in_wishlist?: boolean;
  is_mutual_match?: boolean;
}

export function BookCard({ book, showActions = true }: { book: BookCardData; showActions?: boolean }) {
  const distance = formatDistance(book.distance_km);
  return (
    <article className="group bg-card relative flex h-full flex-col overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/books/${book.id}`}
        className="block focus-visible:outline-none"
        aria-label={`${book.title} by ${book.author}`}
      >
        <div className="relative">
          <BookCover
            book={book}
            className="rounded-none transition-transform duration-300 group-hover:scale-[1.02]"
          />
          <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
            {book.is_mutual_match && (
              <Badge className="bg-forest text-forest-foreground shadow">
                <Sparkles aria-hidden /> Mutual match
              </Badge>
            )}
            {book.status !== "Available" && <BookStatusBadge status={book.status} />}
          </div>
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-serif text-base leading-snug font-semibold">
            <Link href={`/books/${book.id}`} className="hover:underline">
              {book.title}
            </Link>
          </h3>
          <p className="text-muted-foreground line-clamp-1 text-sm">{book.author}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ConditionBadge condition={book.condition} />
          {book.genre && <Badge variant="muted">{book.genre}</Badge>}
        </div>
        {(book.owner_name || distance) && (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {book.owner_name}
              {book.owner_city ? ` · ${book.owner_city}` : ""}
              {distance ? ` · ${distance}` : ""}
            </span>
          </p>
        )}
        {showActions && (
          <div className="mt-auto flex items-center gap-1 pt-1">
            <RequestSwapButton
              book={{ id: book.id, title: book.title, author: book.author }}
              disabled={book.status !== "Available"}
              size="sm"
              className="flex-1"
            />
            <AiInsightsButton book={{ id: book.id, title: book.title, author: book.author }} iconOnly />
            <WishlistButton bookId={book.id} initialInWishlist={Boolean(book.in_wishlist)} />
          </div>
        )}
      </div>
    </article>
  );
}
