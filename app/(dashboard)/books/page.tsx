import type { Metadata } from "next";
import Link from "next/link";
import { BookPlus, Library, ShieldAlert } from "lucide-react";
import { BookCover } from "@/components/books/book-cover";
import { OwnerBookActions } from "@/components/books/owner-book-actions";
import { BookStatusBadge, ConditionBadge } from "@/components/books/status-badges";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireUserOrRedirect } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { BOOK_STATUSES, type BookStatus } from "@/types";

export const metadata: Metadata = { title: "My books" };

const SECTION_COPY: Record<BookStatus, string> = {
  Available: "Live listings",
  Reserved: "Reserved in an active swap",
  Hidden: "Hidden",
  Swapped: "Swapped — history",
};

export default async function MyBooksPage() {
  const user = await requireUserOrRedirect("/books");
  const supabase = await createClient();
  const { data: books, error } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        eyebrow="Your shelf"
        title="My books"
        description="Everything you've listed. Hidden books stay private; swapped books are kept for your swap history."
        actions={
          <Button asChild>
            <Link href="/books/new">
              <BookPlus aria-hidden /> List a book
            </Link>
          </Button>
        }
      />
      {error ? (
        <ErrorState message="Your books couldn't be loaded." />
      ) : !books || books.length === 0 ? (
        <EmptyState
          icon={Library}
          title="Your shelf is empty"
          description="List the books you've finished — it only takes a minute with Google Books autofill."
          action={
            <Button asChild>
              <Link href="/books/new">List your first book</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-10">
          {BOOK_STATUSES.map((status) => {
            const group = books.filter((book) => book.status === status);
            if (group.length === 0) return null;
            return (
              <section key={status} aria-labelledby={`section-${status}`}>
                <h2 id={`section-${status}`} className="mb-3 text-xl font-semibold">
                  {SECTION_COPY[status]}{" "}
                  <span className="text-muted-foreground text-base font-normal">({group.length})</span>
                </h2>
                <ul className="grid gap-3 md:grid-cols-2">
                  {group.map((book) => (
                    <li key={book.id} className="bg-card flex gap-4 rounded-xl border p-3 shadow-sm">
                      <Link href={`/books/${book.id}`} className="w-24 shrink-0">
                        <BookCover book={book} sizes="96px" />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div>
                          <Link
                            href={`/books/${book.id}`}
                            className="line-clamp-2 font-serif text-lg leading-snug font-semibold hover:underline"
                          >
                            {book.title}
                          </Link>
                          <p className="text-muted-foreground truncate text-sm">{book.author}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <BookStatusBadge status={book.status} />
                          <ConditionBadge condition={book.condition} />
                          {!book.cover_image_url && book.status !== "Swapped" && (
                            <span className="dark:text-amber text-xs text-amber-700">No photo yet</span>
                          )}
                        </div>
                        {book.hidden_by_admin && (
                          <p className="text-destructive flex items-center gap-1 text-xs">
                            <ShieldAlert className="size-3.5" aria-hidden /> Hidden by a moderator
                          </p>
                        )}
                        <div className="mt-auto">
                          <OwnerBookActions
                            bookId={book.id}
                            status={book.status}
                            hiddenByAdmin={book.hidden_by_admin}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
