import { describe, expect, it } from "vitest";
import {
  approximateDistanceKm,
  findMutualMatches,
  haversineKm,
  normalizeText,
  wishMatchesBook,
  type MatchableBook,
  type MatchableWish,
} from "@/lib/matching";

const book = (
  id: string,
  ownerId: string,
  title: string,
  author: string,
  status: MatchableBook["status"] = "Available",
): MatchableBook => ({
  id,
  ownerId,
  title,
  author,
  status,
});
const wish = (userId: string, title: string, author: string | null = null): MatchableWish => ({
  userId,
  title,
  author,
});

describe("normalizeText", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(normalizeText("  The  Hobbit! ")).toBe("the hobbit");
    expect(normalizeText("J.R.R. Tolkien")).toBe(normalizeText("J R R  Tolkien"));
    expect(normalizeText(null)).toBe("");
  });
});

describe("wishMatchesBook", () => {
  const hobbit = book("x", "bob", "The Hobbit", "J.R.R. Tolkien");
  it("matches on title with any author when author is blank", () => {
    expect(wishMatchesBook(wish("alice", "the hobbit"), hobbit)).toBe(true);
  });
  it("requires the author to match when given", () => {
    expect(wishMatchesBook(wish("alice", "The Hobbit", "j. r. r. tolkien"), hobbit)).toBe(true);
    expect(wishMatchesBook(wish("alice", "The Hobbit", "Someone Else"), hobbit)).toBe(false);
  });
  it("does not do fuzzy/substring matching", () => {
    expect(wishMatchesBook(wish("alice", "Hobbit"), hobbit)).toBe(false);
  });
});

describe("findMutualMatches", () => {
  const books = [
    book("pnp", "alice", "Pride and Prejudice", "Jane Austen"),
    book("hobbit", "bob", "The Hobbit", "J.R.R. Tolkien"),
    book("dune", "bob", "Dune", "Frank Herbert"),
    book("thinking", "carol", "Thinking, Fast and Slow", "Daniel Kahneman"),
  ];

  it("finds A ↔ B when each wants the other's book", () => {
    const matches = findMutualMatches(books, [
      wish("alice", "The Hobbit"),
      wish("bob", "Pride and Prejudice", "Jane Austen"),
    ]);
    expect(matches).toEqual([{ userA: "alice", userB: "bob", bookA: "pnp", bookB: "hobbit" }]);
  });

  it("ignores one-way interest", () => {
    expect(findMutualMatches(books, [wish("alice", "The Hobbit")])).toEqual([]);
  });

  it("never matches a user with themselves", () => {
    expect(findMutualMatches(books, [wish("bob", "Dune"), wish("bob", "The Hobbit")])).toEqual([]);
  });

  it("excludes hidden and swapped books", () => {
    const withHidden = books.map((b) => (b.id === "hobbit" ? { ...b, status: "Hidden" as const } : b));
    expect(
      findMutualMatches(withHidden, [wish("alice", "The Hobbit"), wish("bob", "Pride and Prejudice")]),
    ).toEqual([]);
    const withSwapped = books.map((b) => (b.id === "pnp" ? { ...b, status: "Swapped" as const } : b));
    expect(
      findMutualMatches(withSwapped, [wish("alice", "The Hobbit"), wish("bob", "Pride and Prejudice")]),
    ).toEqual([]);
  });

  it("keeps reserved books (they may come back) and de-duplicates", () => {
    const reserved = books.map((b) => (b.id === "hobbit" ? { ...b, status: "Reserved" as const } : b));
    const wishes = [
      wish("alice", "The Hobbit"),
      wish("alice", "the hobbit", "J.R.R. Tolkien"),
      wish("bob", "Pride and Prejudice"),
    ];
    expect(findMutualMatches(reserved, wishes)).toHaveLength(1);
  });

  it("finds multiple independent pairs", () => {
    const wishes = [
      wish("alice", "The Hobbit"),
      wish("bob", "Pride and Prejudice"),
      wish("carol", "Dune"),
      wish("bob", "Thinking, Fast and Slow"),
    ];
    const matches = findMutualMatches(books, wishes);
    expect(matches).toHaveLength(2);
    expect(matches).toContainEqual({ userA: "bob", userB: "carol", bookA: "dune", bookB: "thinking" });
  });
});

describe("distance", () => {
  it("computes haversine distances", () => {
    // Bengaluru MG Road → Koramangala is roughly 5 km.
    expect(haversineKm(12.97, 77.59, 12.93, 77.62)).toBeGreaterThan(4);
    expect(haversineKm(12.97, 77.59, 12.93, 77.62)).toBeLessThan(7);
    expect(haversineKm(0, 0, 0, 0)).toBe(0);
  });
  it("never reports less than 1 km publicly", () => {
    expect(approximateDistanceKm(12.97, 77.59, 12.97, 77.59)).toBe(1);
  });
});
