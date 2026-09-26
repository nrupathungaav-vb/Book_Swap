import Link from "next/link";
import { ArrowLeftRight, MapPin } from "lucide-react";
import { BookCover } from "@/components/books/book-cover";
import { MatchStatusBadge } from "@/components/books/status-badges";
import { RequestSwapButton } from "@/components/swaps/request-swap-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDistance, initials } from "@/lib/utils";
import type { Match } from "@/types";

export function MatchCard({ match }: { match: Match }) {
  const distance = formatDistance(match.distance_km);
  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center gap-3 border-b bg-secondary/40 px-4 py-3">
        <Avatar>
          {match.other_user_avatar && <AvatarImage src={match.other_user_avatar} alt="" />}
          <AvatarFallback>{initials(match.other_user_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{match.other_user_name}</p>
          {(match.other_user_city || distance) && (
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3" aria-hidden />
              {[match.other_user_city, distance].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <MatchStatusBadge status={match.match_status} />
      </header>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-4">
        <Link href={`/books/${match.my_book_id}`} className="group space-y-1.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">You give</p>
          <BookCover
            book={{ title: match.my_book_title, author: match.my_book_author, cover_image_url: match.my_book_cover, google_cover_url: null }}
            sizes="160px"
          />
          <p className="line-clamp-2 text-sm font-medium group-hover:underline">{match.my_book_title}</p>
        </Link>
        <ArrowLeftRight className="size-6 text-amber" aria-label="in exchange for" />
        <Link href={`/books/${match.their_book_id}`} className="group space-y-1.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">You get</p>
          <BookCover
            book={{ title: match.their_book_title, author: match.their_book_author, cover_image_url: match.their_book_cover, google_cover_url: null }}
            sizes="160px"
          />
          <p className="line-clamp-2 text-sm font-medium group-hover:underline">{match.their_book_title}</p>
        </Link>
      </div>
      <footer className="border-t px-4 py-3">
        {match.active_swap_id ? (
          <Button asChild variant="outline" className="w-full">
            <Link href={`/swaps/${match.active_swap_id}`}>Open swap</Link>
          </Button>
        ) : (
          <RequestSwapButton
            book={{ id: match.their_book_id, title: match.their_book_title, author: match.their_book_author }}
            preselectedOfferId={match.my_book_id}
            disabled={match.match_status !== "Open"}
            className="w-full"
            label="Propose this swap"
          />
        )}
      </footer>
    </article>
  );
}
