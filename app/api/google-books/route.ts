import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { GoogleBooksError, searchGoogleBooks } from "@/lib/google-books";
import { handleRouteError, jsonError } from "@/lib/utils/api";

export const runtime = "nodejs";

const querySchema = z.object({ q: z.string().trim().min(2).max(120) });

/** Server-side proxy so the (optional) Google Books API key never reaches the browser. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in to search Google Books.", 401);

  const parsed = querySchema.safeParse({ q: new URL(request.url).searchParams.get("q") ?? "" });
  if (!parsed.success) return NextResponse.json({ results: [] });

  try {
    const results = await searchGoogleBooks(parsed.data.q);
    return NextResponse.json({ results }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    if (error instanceof GoogleBooksError) return jsonError(error.message, error.status === 429 ? 429 : 502);
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return jsonError("Google Books took too long to respond.", 504);
    }
    return handleRouteError(error, "Google Books search failed.");
  }
}
