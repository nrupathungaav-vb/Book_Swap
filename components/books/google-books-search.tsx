"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { BookOpen, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import type { GoogleBook } from "@/types";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; results: GoogleBook[] };

/**
 * Autocomplete combobox over Google Books (via our server proxy).
 * Keyboard: ↑/↓ to move, Enter to pick, Esc to close.
 */
export function GoogleBooksSearch({ onSelect }: { onSelect: (book: GoogleBook) => void }) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const debounced = useDebouncedValue(query, 400);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch(`/api/google-books?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { results?: GoogleBook[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Google Books search failed.");
        setState({ status: "done", results: json.results ?? [] });
        setActive(-1);
        setOpen(true);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setState({ status: "error", message: error.message });
      });
    return () => controller.abort();
  }, [debounced]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const results = state.status === "done" ? state.results : [];

  const choose = (book: GoogleBook) => {
    onSelect(book);
    setOpen(false);
    setQuery("");
    setState({ status: "idle" });
  };

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={`${listId}-input`} className="mb-2 block text-sm font-medium">
        Find it on Google Books{" "}
        <span className="text-muted-foreground font-normal">(title, author or ISBN)</span>
      </label>
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
          autoComplete="off"
          value={query}
          placeholder="e.g. The Hobbit Tolkien"
          className="pr-9 pl-9"
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (event.key === "Enter" && open && active >= 0 && results[active]) {
              event.preventDefault();
              choose(results[active]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {state.status === "loading" && (
          <Loader2
            className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin"
            aria-label="Searching"
          />
        )}
      </div>
      <p className="text-muted-foreground mt-1.5 text-xs" aria-live="polite">
        {state.status === "error"
          ? state.message
          : state.status === "done" && results.length === 0
            ? "No matches on Google Books — you can fill in the details yourself."
            : "Picking a result fills in the details. You can edit everything afterwards."}
      </p>

      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="bg-popover absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border p-1 shadow-lg"
        >
          {results.map((book, index) => (
            <li
              key={book.googleBooksId}
              id={`${listId}-opt-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(book);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn("flex cursor-pointer gap-3 rounded-md p-2", index === active && "bg-accent")}
            >
              <div className="bg-muted relative h-16 w-11 shrink-0 overflow-hidden rounded">
                {book.thumbnailUrl ? (
                  <Image src={book.thumbnailUrl} alt="" fill sizes="44px" className="object-cover" />
                ) : (
                  <BookOpen className="text-muted-foreground m-auto mt-5 size-5" aria-hidden />
                )}
              </div>
              <div className="min-w-0 text-sm">
                <p className="line-clamp-2 font-medium">{book.title}</p>
                <p className="text-muted-foreground truncate">
                  {book.authors.join(", ") || "Unknown author"}
                  {book.publishedDate ? ` · ${book.publishedDate.slice(0, 4)}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
