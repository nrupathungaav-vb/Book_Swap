import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { GeminiError, generateInsights } from "@/lib/gemini";
import { AI_HOURLY_LIMIT, loadBookContext } from "@/lib/gemini/book-context";
import { serverEnv } from "@/lib/env.server";
import { handleRouteError, isSameOrigin, jsonError } from "@/lib/utils/api";
import { insightsRequestSchema } from "@/lib/validations/ai";
import type { GeminiResponse } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request blocked.", 403);
  const parsed = insightsRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return jsonError("Invalid request.", 400);

  try {
    const { supabase } = await requireUser();
    const book = await loadBookContext(supabase, parsed.data.bookId);
    if (!book) return jsonError("Book not found.", 404);

    const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", {
      p_kind: "insights",
      p_limit_per_hour: AI_HOURLY_LIMIT,
    });
    if (quotaError) return jsonError("Couldn't check your AI usage. Please retry.", 500);
    if (!allowed) return jsonError("You've reached the hourly AI limit. Please try again later.", 429);

    const insights = await generateInsights(book, { refresh: parsed.data.refresh });
    const body: GeminiResponse = {
      insights,
      model: serverEnv().GEMINI_MODEL,
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GeminiError) return jsonError(error.message, error.status);
    return handleRouteError(error, "AI insights are unavailable right now.");
  }
}
