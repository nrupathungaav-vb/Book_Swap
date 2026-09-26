import { afterEach, describe, expect, it, vi } from "vitest";
import { mapVolume, searchGoogleBooks } from "@/lib/google-books";

describe("mapVolume", () => {
  it("normalises a Google Books volume", () => {
    const book = mapVolume({
      id: "abc123",
      volumeInfo: {
        title: "The Hobbit",
        subtitle: "or There and Back Again",
        authors: ["J.R.R. Tolkien"],
        categories: ["Fiction / Fantasy / Epic"],
        description: "<p>A <b>great</b> adventure &amp; more.</p>",
        industryIdentifiers: [
          { type: "ISBN_10", identifier: "0261102214" },
          { type: "ISBN_13", identifier: "9780261102217" },
        ],
        imageLinks: { thumbnail: "http://books.google.com/books/content?id=abc&zoom=1&edge=curl" },
        publishedDate: "1937-09-21",
        pageCount: 310,
      },
    });
    expect(book).toEqual({
      googleBooksId: "abc123",
      title: "The Hobbit: or There and Back Again",
      authors: ["J.R.R. Tolkien"],
      categories: ["Fiction"],
      description: "A great adventure & more.",
      isbn: "9780261102217",
      publishedDate: "1937-09-21",
      pageCount: 310,
      thumbnailUrl: "https://books.google.com/books/content?id=abc&zoom=1",
    });
  });

  it("skips volumes without a title", () => {
    expect(mapVolume({ id: "x", volumeInfo: {} })).toBeNull();
  });
});

describe("searchGoogleBooks", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses isbn: queries for ISBN input and de-duplicates results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            { id: "a", volumeInfo: { title: "Dune" } },
            { id: "a", volumeInfo: { title: "Dune" } },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const results = await searchGoogleBooks("978-0-441-17271-9");
    expect(results).toHaveLength(1);
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.searchParams.get("q")).toBe("isbn:9780441172719");
  });

  it("returns [] for very short queries without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await searchGoogleBooks("a")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces rate limiting as a friendly error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));
    await expect(searchGoogleBooks("dune")).rejects.toThrow(/rate-limiting/);
  });
});
