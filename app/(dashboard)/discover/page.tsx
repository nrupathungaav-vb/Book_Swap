import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { BookCard } from "@/components/books/book-card";
import { DiscoverFilters } from "@/components/books/discover-filters";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { Stagger, StaggerItem } from "@/components/layout/motion";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/layout/pagination";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { DISCOVER_PAGE_SIZE, parseDiscoverParams, type DiscoverParams } from "@/lib/validations/discover";

export const metadata: Metadata = { title: "Discover books" };

function hrefWith(params: DiscoverParams, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, page })) {
    if (value !== undefined && value !== "" && !(key === "page" && value === 1))
      search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `/discover?${qs}` : "/discover";
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseDiscoverParams(await searchParams);
  const page = params.page ?? 1;
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()]);
  const hasLocation = profile?.geo_lat != null;

  const [{ data: books, error }, { data: genreRows }] = await Promise.all([
    supabase.rpc("discover_books", {
      p_query: params.q ?? null,
      p_genre: params.genre ?? null,
      p_condition: params.condition ?? null,
      p_status: params.status ?? "Available",
      p_max_distance_km: hasLocation ? (params.distance ?? null) : null,
      p_sort: params.sort === "distance" && !hasLocation ? "newest" : (params.sort ?? "newest"),
      p_limit: DISCOVER_PAGE_SIZE,
      p_offset: (page - 1) * DISCOVER_PAGE_SIZE,
    }),
    supabase
      .from("books")
      .select("genre")
      .in("status", ["Available", "Reserved"])
      .not("genre", "is", null)
      .limit(1000),
  ]);

  const genres = [
    ...new Set((genreRows ?? []).map((row) => row.genre).filter((g): g is string => Boolean(g))),
  ].sort();
  const total = Number(books?.[0]?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / DISCOVER_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Discover"
        title="Find your next read"
        description="Books listed by readers near you. Look for the mutual-match ribbon — those swaps are a sure thing."
      />
      <DiscoverFilters params={params} genres={genres} hasLocation={hasLocation} />

      {error ? (
        <ErrorState message="Books couldn't be loaded. Please refresh the page." />
      ) : !books || books.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No books found."
          description={
            params.q || params.genre || params.condition || params.distance
              ? "Try widening your filters."
              : "Nobody else has listed a book yet — check back soon."
          }
        />
      ) : (
        <>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {total} book{total === 1 ? "" : "s"} found
          </p>
          <Stagger
            className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
            key={hrefWith(params, page)}
          >
            {books.map((book) => (
              <StaggerItem key={book.id}>
                <BookCard book={book} />
              </StaggerItem>
            ))}
          </Stagger>
          <Pagination page={page} totalPages={totalPages} hrefFor={(p) => hrefWith(params, p)} />
        </>
      )}
    </div>
  );
}
