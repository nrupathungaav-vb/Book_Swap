import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ExternalLink, Info, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { ReportButton } from "@/components/admin/report-dialog";
import { AiInsightsButton } from "@/components/books/ai-insights-sheet";
import { BookCover } from "@/components/books/book-cover";
import { OwnerBookActions } from "@/components/books/owner-book-actions";
import { BookStatusBadge, ConditionBadge } from "@/components/books/status-badges";
import { FadeIn } from "@/components/layout/motion";
import { RequestSwapButton } from "@/components/swaps/request-swap-dialog";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDistance, initials } from "@/lib/utils";
import { uuidSchema } from "@/lib/validations/common";

type Props = { params: Promise<{ id: string }> };

async function loadBook(id: string) {
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  // RLS decides visibility: live listings for everyone, hidden/swapped only for owner/participants/admins.
  const { data: book } = await supabase.from("books").select("*").eq("id", id).maybeSingle();
  if (!book) return null;
  const { data: owner } = await supabase
    .from("public_profiles")
    .select("*")
    .eq("id", book.user_id)
    .maybeSingle();
  return { supabase, book, owner };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const loaded = await loadBook(id);
  if (!loaded) return { title: "Book not found" };
  return {
    title: `${loaded.book.title} by ${loaded.book.author}`,
    description: loaded.book.description?.slice(0, 160) ?? `Swap for ${loaded.book.title} on BookSwap.`,
  };
}

export default async function BookDetailsPage({ params }: Props) {
  const { id } = await params;
  const loaded = await loadBook(id);
  if (!loaded) notFound();
  const { supabase, book, owner } = loaded;
  const user = await getCurrentUser();
  const isOwner = user?.id === book.user_id;

  let distance: number | null = null;
  let inWishlist = false;
  let isMatch = false;
  if (user && !isOwner) {
    const [dist, wish, match] = await Promise.all([
      supabase.rpc("approx_distance_km", { p_other_user_id: book.user_id }),
      supabase
        .from("wishlists")
        .select("author_norm")
        .eq("user_id", user.id)
        .eq("title_norm", book.title_norm),
      supabase.from("matches").select("id").or(`book_a_id.eq.${book.id},book_b_id.eq.${book.id}`).limit(1),
    ]);
    distance = dist.data ?? null;
    inWishlist = (wish.data ?? []).some((w) => w.author_norm === "" || w.author_norm === book.author_norm);
    isMatch = (match.data ?? []).length > 0;
  }

  return (
    <article className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <FadeIn>
        <BookCover
          book={book}
          priority
          sizes="(min-width: 768px) 40vw, 100vw"
          className="rounded-2xl border shadow-md"
        />
        {book.cover_image_url && (
          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
            <ShieldCheck className="text-forest size-3.5" aria-hidden /> Photo of the actual copy, taken by
            its owner.
          </p>
        )}
      </FadeIn>

      <FadeIn delay={0.08} className="space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <BookStatusBadge status={book.status} />
            <ConditionBadge condition={book.condition} />
            {book.genre && <Badge variant="muted">{book.genre}</Badge>}
            {isMatch && (
              <Badge className="bg-forest text-forest-foreground">
                <Sparkles aria-hidden /> Mutual match
              </Badge>
            )}
          </div>
          <h1 className="text-3xl leading-tight font-semibold sm:text-4xl">{book.title}</h1>
          <p className="text-muted-foreground text-lg">by {book.author}</p>
        </div>

        {isOwner ? (
          <div className="bg-secondary/40 space-y-3 rounded-xl border p-4">
            <p className="text-sm font-medium">This is your listing.</p>
            <OwnerBookActions bookId={book.id} status={book.status} hiddenByAdmin={book.hidden_by_admin} />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <RequestSwapButton
              book={{ id: book.id, title: book.title, author: book.author }}
              disabled={book.status !== "Available"}
              size="lg"
            />
            <AiInsightsButton book={{ id: book.id, title: book.title, author: book.author }} />
            {user ? (
              <WishlistButton bookId={book.id} initialInWishlist={inWishlist} withLabel />
            ) : (
              <Button asChild variant="outline">
                <Link href={`/login?next=/books/${book.id}`}>Sign in to save</Link>
              </Button>
            )}
          </div>
        )}

        {book.status === "Reserved" && !isOwner && (
          <Alert variant="info">
            <Info aria-hidden />
            <AlertDescription>
              This copy is reserved in another swap right now. Add it to your wishlist to be matched with
              other copies.
            </AlertDescription>
          </Alert>
        )}

        {book.description && (
          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className="mb-2 text-xl font-semibold">
              About this copy
            </h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{book.description}</p>
          </section>
        )}

        {owner && (
          <section
            aria-labelledby="owner-heading"
            className="bg-card flex items-center gap-3 rounded-xl border p-4"
          >
            <h2 id="owner-heading" className="sr-only">
              Listed by
            </h2>
            <Avatar className="size-12">
              {owner.avatar_url && <AvatarImage src={owner.avatar_url} alt="" />}
              <AvatarFallback>{initials(owner.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{owner.full_name ?? "A reader"}</p>
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-3">
                {(owner.location_city || distance) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {[owner.location_city, formatDistance(distance)].filter(Boolean).join(" · ")}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3.5" aria-hidden /> Member since{" "}
                  {new Date(owner.created_at).getFullYear()}
                </span>
              </p>
            </div>
            {user && !isOwner && <ReportButton target="user" userId={owner.id} label="Report" />}
          </section>
        )}

        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Condition</dt>
            <dd className="font-medium">{book.condition}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Availability</dt>
            <dd className="font-medium">{book.status}</dd>
          </div>
          {book.isbn && (
            <div>
              <dt className="text-muted-foreground">ISBN</dt>
              <dd className="font-medium">{book.isbn}</dd>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {book.google_books_id && (
            <Button asChild variant="link" className="px-0">
              <a
                href={`https://books.google.com/books?id=${encodeURIComponent(book.google_books_id)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Google Books <ExternalLink aria-hidden />
              </a>
            </Button>
          )}
          {user && !isOwner && (
            <div className="ml-auto">
              <ReportButton target="book" bookId={book.id} />
            </div>
          )}
        </div>
      </FadeIn>
    </article>
  );
}
