import { describe, expect, it } from "vitest";
import { bookImageUrl, formatDistance, formatRelativeTime, initials, truncate } from "@/lib/utils";
import { safeNextPath } from "@/lib/utils/redirect";
import { bookImagePath, storagePathFromPublicUrl } from "@/lib/utils/storage";
import { notificationHref } from "@/lib/notifications";

describe("formatting", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  it("formats relative times", () => {
    expect(formatRelativeTime("2026-09-26T11:59:40Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-09-26T11:55:00Z", now)).toBe("5 minutes ago");
    expect(formatRelativeTime("2026-09-25T12:00:00Z", now)).toBe("yesterday");
  });
  it("formats distances without false precision", () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(1)).toBe("under 1 km away");
    expect(formatDistance(6)).toBe("~6 km away");
  });
  it("builds initials", () => {
    expect(initials("Alice Fernandes")).toBe("AF");
    expect(initials("bob")).toBe("B");
    expect(initials(null)).toBe("?");
  });
  it("truncates", () => {
    expect(truncate("hello world", 6)).toBe("hello…");
    expect(truncate("hi", 6)).toBe("hi");
  });
});

describe("bookImageUrl — physical photo always wins", () => {
  it("prefers the uploaded photo, then Google, then nothing", () => {
    expect(bookImageUrl({ cover_image_url: "https://x.supabase.co/p.jpg", google_cover_url: "https://books.google.com/g" })).toBe(
      "https://x.supabase.co/p.jpg",
    );
    expect(bookImageUrl({ cover_image_url: null, google_cover_url: "https://books.google.com/g" })).toBe("https://books.google.com/g");
    expect(bookImageUrl({ cover_image_url: null, google_cover_url: null })).toBeNull();
  });
});

describe("safeNextPath (open-redirect protection)", () => {
  it.each([
    ["/swaps/123", "/swaps/123"],
    ["/discover?q=dune", "/discover?q=dune"],
    ["https://evil.example", "/dashboard"],
    ["//evil.example/path", "/dashboard"],
    ["/\\evil.example", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    [null, "/dashboard"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("storage paths", () => {
  it("builds {user}/{book}/{file}", () => {
    expect(bookImagePath("u1", "b1", "a.webp")).toBe("u1/b1/a.webp");
  });
  it("extracts object paths only for the right bucket", () => {
    const url = "https://abc.supabase.co/storage/v1/object/public/book-covers/u1/b1/a%20b.webp";
    expect(storagePathFromPublicUrl(url, "book-covers")).toBe("u1/b1/a b.webp");
    expect(storagePathFromPublicUrl(url, "avatars")).toBeNull();
    expect(storagePathFromPublicUrl("not a url", "book-covers")).toBeNull();
    expect(storagePathFromPublicUrl(null, "book-covers")).toBeNull();
  });
});

describe("notificationHref", () => {
  it("routes to the most specific place", () => {
    expect(notificationHref({ type: "new_message", related_swap_id: "s1", related_book_id: null })).toBe("/swaps/s1");
    expect(notificationHref({ type: "mutual_match", related_swap_id: null, related_book_id: "b1" })).toBe("/matches");
    expect(notificationHref({ type: "report_update", related_swap_id: null, related_book_id: "b1" })).toBe("/books/b1");
    expect(notificationHref({ type: "report_update", related_swap_id: null, related_book_id: null })).toBe("/notifications");
  });
});
