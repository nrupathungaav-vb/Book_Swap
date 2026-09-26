import type {
  BookRow,
  DiscoverBookRow,
  MatchResultRow,
  MeetingLocationRow,
  MessageRow,
  NotificationRow,
  ProfileRow,
  PublicProfileRow,
  ReportRow,
  SwapRequestRow,
  WishlistRow,
} from "@/types/database";

export * from "@/types/database";

/** Private profile: only ever loaded for the signed-in user. */
export type Profile = ProfileRow;
/** Safe-to-share profile fields (no email, coordinates or role). */
export type PublicProfile = PublicProfileRow;
export type Book = BookRow;
export type Wishlist = WishlistRow;
export type SwapRequest = SwapRequestRow;
export type Match = MatchResultRow;
export type Message = MessageRow;
export type MeetingLocation = MeetingLocationRow;
export type Notification = NotificationRow;
export type Report = ReportRow;
export type DiscoverBook = DiscoverBookRow;

/** A book together with its (public) owner. */
export interface BookWithOwner extends Book {
  owner: PublicProfile | null;
}

/** A swap with both books and both participants resolved. */
export interface SwapDetails extends SwapRequest {
  requested_book: Book;
  offered_book: Book;
  requester: PublicProfile;
  responder: PublicProfile;
}

/** Normalised Google Books volume used to pre-fill the listing form. */
export interface GoogleBook {
  googleBooksId: string;
  title: string;
  authors: string[];
  categories: string[];
  description: string | null;
  isbn: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  thumbnailUrl: string | null;
}

/** Structured "Know Before You Swap" insight returned by Gemini. */
export interface GeminiInsights {
  summary: string[];
  tone: {
    pacing: string;
    mood: string;
    difficulty: string;
    style: string[];
  };
  audience: string;
  similarReads: { title: string; author: string; why: string }[];
  confidence: "high" | "medium" | "low";
  caveats: string | null;
}

export interface GeminiResponse {
  insights: GeminiInsights;
  model: string;
  generatedAt: string;
}

/** Uniform result for server actions consumed by client forms. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };
