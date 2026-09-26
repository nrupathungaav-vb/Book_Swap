/**
 * TypeScript mirror of the database matching rules (public.normalize_text and
 * public.compute_mutual_matches). The database is authoritative — this module
 * exists for documentation, client-side hints and unit tests.
 */

export function normalizeText(input: string | null | undefined): string {
  return (input ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface MatchableBook {
  id: string;
  ownerId: string;
  title: string;
  author: string;
  status: "Available" | "Reserved" | "Swapped" | "Hidden";
}

export interface MatchableWish {
  userId: string;
  title: string;
  author: string | null;
}

/** A wishlist entry matches a book on normalised title; a blank author matches any author. */
export function wishMatchesBook(wish: MatchableWish, book: MatchableBook): boolean {
  if (normalizeText(wish.title) !== normalizeText(book.title)) return false;
  const wishAuthor = normalizeText(wish.author);
  return wishAuthor === "" || wishAuthor === normalizeText(book.author);
}

const LIVE = new Set(["Available", "Reserved"]);

export interface MutualMatch {
  userA: string;
  userB: string;
  bookA: string; // owned by A, wanted by B
  bookB: string; // owned by B, wanted by A
}

/**
 * Reference implementation over in-memory arrays (used by tests). Canonical
 * ordering mirrors the DB: userA < userB, de-duplicated per book pair.
 */
export function findMutualMatches(books: MatchableBook[], wishes: MatchableWish[]): MutualMatch[] {
  const liveBooks = books.filter((book) => LIVE.has(book.status));
  const wantedBy = (book: MatchableBook) =>
    new Set(
      wishes
        .filter((wish) => wish.userId !== book.ownerId && wishMatchesBook(wish, book))
        .map((w) => w.userId),
    );

  const results = new Map<string, MutualMatch>();
  for (const x of liveBooks) {
    const xWanters = wantedBy(x);
    for (const y of liveBooks) {
      if (y.ownerId === x.ownerId || !xWanters.has(y.ownerId)) continue;
      if (!wantedBy(y).has(x.ownerId)) continue;
      const [a, b] = x.ownerId < y.ownerId ? [x, y] : [y, x];
      const key = `${a.id}:${b.id}`;
      if (!results.has(key))
        results.set(key, { userA: a.ownerId, userB: b.ownerId, bookA: a.id, bookB: b.id });
    }
  }
  return [...results.values()];
}

/** Haversine distance in km (mirrors public.haversine_km). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Public-facing distance: whole kilometres, never below 1 (mirrors approx_distance_km). */
export function approximateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.max(1, Math.round(haversineKm(lat1, lng1, lat2, lng2)));
}
