import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { requireServerEnv, serverEnv } from "@/lib/env.server";
import { normalizeText } from "@/lib/matching";
import {
  INSIGHTS_RESPONSE_SCHEMA,
  SYSTEM_INSTRUCTION,
  insightsPrompt,
  questionPrompt,
  type BookContext,
} from "@/lib/gemini/prompts";
import type { GeminiInsights } from "@/types";

/**
 * Minimal Gemini REST client (server-only). The API key is sent in a header and
 * never reaches the browser. We use REST instead of an SDK to keep the bundle
 * small and the request shape explicit.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = "GeminiError";
  }
}

const insightsSchema = z.object({
  summary: z.array(z.string().min(1).max(400)).min(1).max(5),
  tone: z.object({
    pacing: z.string().max(200),
    mood: z.string().max(200),
    difficulty: z.string().max(200),
    style: z.array(z.string().max(60)).max(6),
  }),
  audience: z.string().max(600),
  similarReads: z
    .array(z.object({ title: z.string().max(200), author: z.string().max(200), why: z.string().max(300) }))
    .max(5),
  confidence: z.enum(["high", "medium", "low"]),
  caveats: z.string().max(600).nullable().optional().transform((v) => v ?? null),
});

interface GeminiPart {
  text?: string;
}
interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
}
interface GeminiGenerateResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
}

function model(): string {
  return serverEnv().GEMINI_MODEL;
}

async function callGemini(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const apiKey = requireServerEnv("GEMINI_API_KEY");
  const res = await fetch(`${API_BASE}/${encodeURIComponent(model())}:${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const status = res.status;
    if (status === 429) throw new GeminiError("The AI service is busy right now. Please try again shortly.", 429);
    if (status === 400 || status === 403) {
      console.error("[gemini] request rejected", status, await res.text().catch(() => ""));
      throw new GeminiError("The AI service rejected the request. Check the Gemini API key/model configuration.", 502);
    }
    throw new GeminiError("The AI service is unavailable. Please try again.", 502);
  }
  return res;
}

function textOf(response: GeminiGenerateResponse): string {
  if (response.promptFeedback?.blockReason) {
    throw new GeminiError("The AI declined to answer this request.", 422);
  }
  return (response.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

async function generateInsightsUncached(book: BookContext): Promise<GeminiInsights> {
  const res = await callGemini("generateContent", {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text: insightsPrompt(book) }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1200,
      responseMimeType: "application/json",
      responseSchema: INSIGHTS_RESPONSE_SCHEMA,
    },
  });
  const raw = textOf((await res.json()) as GeminiGenerateResponse);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new GeminiError("The AI returned an unreadable answer. Please retry.");
  }
  const parsed = insightsSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new GeminiError("The AI returned an incomplete answer. Please retry.");
  }
  return { ...parsed.data, summary: parsed.data.summary.slice(0, 3), similarReads: parsed.data.similarReads.slice(0, 3) };
}

/**
 * Insights are about the *title*, not a specific copy, so they're cached for a
 * week per normalised title+author (Next.js data cache) to save quota.
 */
export async function generateInsights(book: BookContext, { refresh = false } = {}): Promise<GeminiInsights> {
  if (refresh) return generateInsightsUncached(book);
  const key = `${normalizeText(book.title)}::${normalizeText(book.author)}::${model()}`;
  const cached = unstable_cache(() => generateInsightsUncached(book), ["gemini-insights", key], {
    revalidate: 60 * 60 * 24 * 7,
    tags: ["gemini-insights"],
  });
  return cached();
}

/**
 * Streams an answer as plain UTF-8 text chunks using Gemini's SSE endpoint.
 */
export async function streamAnswer(
  book: BookContext,
  question: string,
  history: { role: "user" | "model"; text: string }[],
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const res = await callGemini(
    "streamGenerateContent?alt=sse",
    {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [
        ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text.slice(0, 2000) }] })),
        { role: "user", parts: [{ text: questionPrompt(book, question) }] },
      ],
      generationConfig: { temperature: 0.5, maxOutputTokens: 400 },
    },
    signal,
  );

  const body = res.body;
  if (!body) throw new GeminiError("The AI returned an empty response.");

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";
        for (const event of events) {
          for (const line of event.split(/\r?\n/)) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const text = textOf(JSON.parse(payload) as GeminiGenerateResponse);
              if (text) controller.enqueue(encoder.encode(text));
            } catch (error) {
              if (error instanceof GeminiError) controller.error(error);
            }
          }
        }
      },
    }),
  );
}

export { insightsSchema };
