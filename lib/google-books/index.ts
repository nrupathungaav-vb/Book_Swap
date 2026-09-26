import "server-only";
import { serverEnv } from "@/lib/env.server";
import type { GoogleBook } from "@/types";

const ENDPOINT = "https://www.googleapis.com/books/v1/volumes";

interface VolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  categories?: string[];
  description?: string;
  publishedDate?: string;
  pageCount?: number;
  industryIdentifiers?: { type: string; identifier: string }[];
  imageLinks?: { smallThumbnail?: string; thumbnail?: string; small?: string; medium?: string };
}

interface Volume {
  id: string;
  volumeInfo?: VolumeInfo;
}

interface VolumesResponse {
  totalItems?: number;
  items?: Volume[];
}

export class GoogleBooksError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "GoogleBooksError";
  }
}

/** Strips HTML tags Google includes in some descriptions. */
function plainText(html: string | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? text.slice(0, 4000) : null;
}

function httpsImage(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\//, "https://").replace("&edge=curl", "");
}

export function mapVolume(volume: Volume): GoogleBook | null {
  const info = volume.volumeInfo;
  if (!info?.title) return null;
  const identifiers = info.industryIdentifiers ?? [];
  const isbn =
    identifiers.find((id) => id.type === "ISBN_13")?.identifier ??
    identifiers.find((id) => id.type === "ISBN_10")?.identifier ??
    null;
  return {
    googleBooksId: volume.id,
    title: info.subtitle ? `${info.title}: ${info.subtitle}` : info.title,
    authors: info.authors ?? [],
    categories: (info.categories ?? []).map((c) => c.split("/")[0]?.trim() ?? c).filter(Boolean),
    description: plainText(info.description),
    isbn,
    publishedDate: info.publishedDate ?? null,
    pageCount: info.pageCount ?? null,
    thumbnailUrl: httpsImage(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
  };
}

/** Searches Google Books. Works without an API key at low volume. */
export async function searchGoogleBooks(query: string, maxResults = 8): Promise<GoogleBook[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const isIsbn = /^[0-9Xx-]{10,17}$/.test(q);
  const params = new URLSearchParams({
    q: isIsbn ? `isbn:${q.replace(/-/g, "")}` : q,
    maxResults: String(Math.min(Math.max(maxResults, 1), 20)),
    printType: "books",
    projection: "full",
  });
  const key = serverEnv().GOOGLE_BOOKS_API_KEY;
  if (key) params.set("key", key);

  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 * 24 },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new GoogleBooksError(
      res.status === 429 ? "Google Books is rate-limiting requests. Try again in a minute." : "Google Books search failed.",
      res.status,
    );
  }
  const json = (await res.json()) as VolumesResponse;
  const seen = new Set<string>();
  return (json.items ?? [])
    .map(mapVolume)
    .filter((book): book is GoogleBook => {
      if (!book || seen.has(book.googleBooksId)) return false;
      seen.add(book.googleBooksId);
      return true;
    });
}

export async function getGoogleBook(id: string): Promise<GoogleBook | null> {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) return null;
  const key = serverEnv().GOOGLE_BOOKS_API_KEY;
  const url = `${ENDPOINT}/${encodeURIComponent(id)}${key ? `?key=${encodeURIComponent(key)}` : ""}`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  return mapVolume((await res.json()) as Volume);
}
