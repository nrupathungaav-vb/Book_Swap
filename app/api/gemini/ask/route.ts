import { requireUser } from "@/lib/auth/session";
import { GeminiError, streamAnswer } from "@/lib/gemini";
import { AI_HOURLY_LIMIT, loadBookContext } from "@/lib/gemini/book-context";
import { handleRouteError, isSameOrigin, jsonError } from "@/lib/utils/api";
import { questionRequestSchema } from "@/lib/validations/ai";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Streams a plain-text answer to a reader's question about a book. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request blocked.", 403);
  const parsed = questionRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid question.", 400);

  try {
    const { supabase } = await requireUser();
    const book = await loadBookContext(supabase, parsed.data.bookId);
    if (!book) return jsonError("Book not found.", 404);

    const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", {
      p_kind: "question",
      p_limit_per_hour: AI_HOURLY_LIMIT,
    });
    if (quotaError) return jsonError("Couldn't check your AI usage. Please retry.", 500);
    if (!allowed) return jsonError("You've reached the hourly AI limit. Please try again later.", 429);

    const stream = await streamAnswer(book, parsed.data.question, parsed.data.history, request.signal);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof GeminiError) return jsonError(error.message, error.status);
    return handleRouteError(error, "The AI couldn't answer right now.");
  }
}
