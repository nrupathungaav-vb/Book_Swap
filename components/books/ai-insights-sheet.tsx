"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Info, Loader2, RotateCcw, Send, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { GeminiInsights, GeminiResponse } from "@/types";

const QUICK_PROMPTS = [
  "Is this book beginner-friendly?",
  "What kind of reading experience should I expect?",
  "What topics does it explore?",
  "Is it a good fit for a teenage reader?",
];

type Turn = { role: "user" | "model"; text: string };

async function readError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string };
    return json.error ?? "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

export function AiInsightsButton({
  book,
  iconOnly = false,
}: {
  book: { id: string; title: string; author: string };
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={iconOnly ? "icon-sm" : "default"}
          aria-label={iconOnly ? `AI insights for ${book.title}` : undefined}
          title="Know Before You Swap — AI insights"
        >
          <Sparkles className="text-amber" aria-hidden />
          {!iconOnly && "AI insights"}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <p className="text-primary flex items-center gap-1.5 text-xs font-semibold tracking-[0.18em] uppercase">
            <Sparkles className="size-3.5" aria-hidden /> Know Before You Swap
          </p>
          <SheetTitle>{book.title}</SheetTitle>
          <SheetDescription>by {book.author}</SheetDescription>
        </SheetHeader>
        {open && <InsightsBody bookId={book.id} />}
      </SheetContent>
    </Sheet>
  );
}

function InsightsBody({ bookId }: { bookId: string }) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: GeminiResponse }
  >({ status: "loading" });

  const load = useCallback(
    async (refresh = false) => {
      setState({ status: "loading" });
      try {
        const res = await fetch("/api/gemini/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId, refresh }),
        });
        if (!res.ok) {
          setState({ status: "error", message: await readError(res) });
          return;
        }
        setState({ status: "ready", data: (await res.json()) as GeminiResponse });
      } catch {
        setState({ status: "error", message: "Network error — check your connection and retry." });
      }
    },
    [bookId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 p-5">
      <Alert variant="info">
        <Info aria-hidden />
        <AlertDescription>
          AI-generated impressions, not verified book facts. Always check the listing and photo for the copy
          itself.
        </AlertDescription>
      </Alert>

      <section aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "loading" && <InsightsSkeleton />}
        {state.status === "error" && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertTitle>Couldn&apos;t load insights</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{state.message}</p>
              <Button size="sm" variant="outline" onClick={() => void load()}>
                <RotateCcw aria-hidden /> Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {state.status === "ready" && (
          <InsightsView insights={state.data.insights} onRefresh={() => void load(true)} />
        )}
      </section>

      <QuestionBox bookId={bookId} />
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="space-y-4" role="status">
      <span className="sr-only">Generating insights…</span>
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-10/12" />
      <Skeleton className="mt-6 h-5 w-28" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    </div>
  );
}

const CONFIDENCE_COPY: Record<
  GeminiInsights["confidence"],
  { label: string; variant: "forest" | "amber" | "destructive" }
> = {
  high: { label: "AI is familiar with this book", variant: "forest" },
  medium: { label: "AI is partly familiar — double-check", variant: "amber" },
  low: { label: "AI doesn't know this exact book", variant: "destructive" },
};

function InsightsView({ insights, onRefresh }: { insights: GeminiInsights; onRefresh: () => void }) {
  const confidence = CONFIDENCE_COPY[insights.confidence];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={confidence.variant}>{confidence.label}</Badge>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RotateCcw aria-hidden /> Regenerate
        </Button>
      </div>

      <div>
        <h3 className="mb-2 font-serif text-lg font-semibold">Quick summary</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          {insights.summary.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-serif text-lg font-semibold">Tone &amp; vibes</h3>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          {(
            [
              ["Pacing", insights.tone.pacing],
              ["Mood", insights.tone.mood],
              ["Difficulty", insights.tone.difficulty],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="bg-muted rounded-lg p-3">
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {insights.tone.style.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {insights.tone.style.map((style) => (
              <Badge key={style} variant="amber">
                {style}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-serif text-lg font-semibold">Who it&apos;s for</h3>
        <p className="text-sm">{insights.audience}</p>
      </div>

      {insights.similarReads.length > 0 && (
        <div>
          <h3 className="mb-2 font-serif text-lg font-semibold">Similar reads</h3>
          <ul className="space-y-2">
            {insights.similarReads.map((read) => (
              <li key={`${read.title}-${read.author}`} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {read.title} <span className="text-muted-foreground font-normal">· {read.author}</span>
                </p>
                <p className="text-muted-foreground">{read.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insights.caveats && <p className="text-muted-foreground text-xs italic">Note: {insights.caveats}</p>}
    </div>
  );
}

function QuestionBox({ bookId }: { bookId: string }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastQuestion = useRef<string>("");

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 3 || streaming) return;
    lastQuestion.current = trimmed;
    setError(null);
    setQuestion("");
    const history = turns.slice(-6);
    setTurns((current) => [...current, { role: "user", text: trimmed }, { role: "model", text: "" }]);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/gemini/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, question: trimmed, history }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const message = await readError(res);
        setTurns((current) => current.slice(0, -2));
        setError(message);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setTurns((current) => {
          const next = [...current];
          const last = next[next.length - 1];
          if (last) next[next.length - 1] = { ...last, text: last.text + chunk };
          return next;
        });
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setTurns((current) => current.slice(0, -2));
        setError("The answer was interrupted. Please retry.");
      }
    } finally {
      setStreaming(false);
    }
  };

  return (
    <section aria-labelledby="qa-heading" className="space-y-3 border-t pt-5">
      <h3 id="qa-heading" className="font-serif text-lg font-semibold">
        Ask about this book
      </h3>
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={streaming}
            onClick={() => void ask(prompt)}
            className="bg-card hover:bg-accent focus-visible:ring-ring rounded-full border px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="space-y-3" aria-live="polite">
        {turns.map((turn, index) => (
          <div
            key={index}
            className={cn(
              "rounded-lg p-3 text-sm whitespace-pre-wrap",
              turn.role === "user" ? "bg-primary/10 ml-8" : "bg-muted mr-8",
            )}
          >
            <span className="sr-only">{turn.role === "user" ? "You asked:" : "AI answered:"}</span>
            {turn.text ||
              (streaming && index === turns.length - 1 ? (
                <Loader2 className="size-4 animate-spin" aria-label="Thinking" />
              ) : null)}
          </div>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {error}
            <Button size="sm" variant="outline" onClick={() => void ask(lastQuestion.current)}>
              <RotateCcw aria-hidden /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <label htmlFor={`ai-question-${bookId}`} className="sr-only">
          Your question
        </label>
        <Input
          id={`ai-question-${bookId}`}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={300}
          placeholder="Ask anything about this book…"
          disabled={streaming}
        />
        <Button type="submit" size="icon" disabled={streaming || question.trim().length < 3} aria-label="Ask">
          {streaming ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        </Button>
      </form>
    </section>
  );
}
