import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import { bookSchema } from "@/lib/validations/book";
import { parseDiscoverParams } from "@/lib/validations/discover";
import { meetingSchema } from "@/lib/validations/meeting";
import { messageSchema } from "@/lib/validations/message";
import { profileSchema } from "@/lib/validations/profile";
import { reportSchema } from "@/lib/validations/report";
import { swapRequestSchema } from "@/lib/validations/swap";
import { wishlistSchema } from "@/lib/validations/wishlist";
import { questionRequestSchema } from "@/lib/validations/ai";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("auth validation", () => {
  it("normalises email and requires a password", () => {
    const parsed = loginSchema.parse({ email: "  Alice@Example.COM ", password: "x" });
    expect(parsed.email).toBe("alice@example.com");
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });

  it("enforces password rules and matching confirmation", () => {
    const base = { fullName: "Alice", email: "a@b.co", password: "bookswap1", confirmPassword: "bookswap1" };
    expect(registerSchema.safeParse(base).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, password: "short1", confirmPassword: "short1" }).success).toBe(
      false,
    );
    expect(
      registerSchema.safeParse({ ...base, password: "lettersonly", confirmPassword: "lettersonly" }).success,
    ).toBe(false);
    const mismatch = registerSchema.safeParse({ ...base, confirmPassword: "different1" });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("validates forgot- and reset-password input", () => {
    expect(forgotPasswordSchema.parse({ email: " Bob@Example.com" }).email).toBe("bob@example.com");
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ password: "newpass12", confirmPassword: "newpass12" }).success,
    ).toBe(true);
    expect(resetPasswordSchema.safeParse({ password: "short1", confirmPassword: "short1" }).success).toBe(
      false,
    );
    const mismatch = resetPasswordSchema.safeParse({ password: "newpass12", confirmPassword: "newpass13" });
    expect(mismatch.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});

describe("book validation", () => {
  const valid = { title: "Dune", author: "Frank Herbert", condition: "Good" as const };

  it("accepts a minimal book and fills defaults", () => {
    const parsed = bookSchema.parse(valid);
    expect(parsed.publish).toBe(true);
    expect(parsed.genre).toBeNull();
    expect(parsed.isbn).toBeNull();
  });

  it("rejects unknown conditions, empty titles and bad ISBNs", () => {
    expect(bookSchema.safeParse({ ...valid, condition: "Mint" }).success).toBe(false);
    expect(bookSchema.safeParse({ ...valid, title: "   " }).success).toBe(false);
    expect(bookSchema.safeParse({ ...valid, isbn: "abc" }).success).toBe(false);
    expect(bookSchema.safeParse({ ...valid, isbn: "978-0-14-143951-8" }).success).toBe(true);
  });

  it("only allows https Google cover URLs", () => {
    expect(bookSchema.safeParse({ ...valid, googleCoverUrl: "http://books.google.com/x" }).success).toBe(
      false,
    );
    expect(bookSchema.safeParse({ ...valid, googleCoverUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(bookSchema.parse({ ...valid, googleCoverUrl: "" }).googleCoverUrl).toBeNull();
  });
});

describe("wishlist / swap / message / report validation", () => {
  it("wishlist author is optional", () => {
    expect(wishlistSchema.parse({ title: "Emma", author: "" }).author).toBeNull();
    expect(wishlistSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("swap request needs two different books", () => {
    expect(swapRequestSchema.safeParse({ requestedBookId: A, offeredBookId: B }).success).toBe(true);
    expect(swapRequestSchema.safeParse({ requestedBookId: A, offeredBookId: A }).success).toBe(false);
    expect(swapRequestSchema.safeParse({ requestedBookId: "x", offeredBookId: B }).success).toBe(false);
  });

  it("messages are trimmed and bounded", () => {
    expect(messageSchema.parse({ swapId: A, text: "  hi  " }).text).toBe("hi");
    expect(messageSchema.safeParse({ swapId: A, text: "   " }).success).toBe(false);
    expect(messageSchema.safeParse({ swapId: A, text: "x".repeat(2001) }).success).toBe(false);
  });

  it("reports need a target and a known reason", () => {
    expect(reportSchema.safeParse({ reportedBookId: A, reason: "Spam" }).success).toBe(true);
    expect(reportSchema.safeParse({ reason: "Spam" }).success).toBe(false);
    expect(reportSchema.safeParse({ reportedBookId: A, reason: "Because" }).success).toBe(false);
  });
});

describe("meeting / profile / AI validation", () => {
  it("meeting needs a named place and a future time", () => {
    const base = { swapId: A, lat: 12.97, lng: 77.59, locationName: "Central Library" };
    expect(meetingSchema.safeParse(base).success).toBe(true);
    expect(meetingSchema.safeParse({ ...base, lat: 120 }).success).toBe(false);
    expect(meetingSchema.safeParse({ ...base, locationName: "x" }).success).toBe(false);
    expect(meetingSchema.safeParse({ ...base, suggestedTime: "2000-01-01T10:00:00Z" }).success).toBe(false);
    expect(
      meetingSchema.safeParse({ ...base, suggestedTime: new Date(Date.now() + 86_400_000).toISOString() })
        .success,
    ).toBe(true);
  });

  it("profile coordinates come in pairs", () => {
    expect(profileSchema.safeParse({ fullName: "Al", geoLat: 12.9, geoLng: 77.6 }).success).toBe(true);
    expect(profileSchema.safeParse({ fullName: "Al", geoLat: 12.9, geoLng: null }).success).toBe(false);
  });

  it("AI questions are bounded", () => {
    expect(questionRequestSchema.safeParse({ bookId: A, question: "Is it long?" }).success).toBe(true);
    expect(questionRequestSchema.safeParse({ bookId: A, question: "?" }).success).toBe(false);
    expect(questionRequestSchema.safeParse({ bookId: A, question: "x".repeat(301) }).success).toBe(false);
  });
});

describe("discover params", () => {
  it("parses valid params and drops junk", () => {
    expect(
      parseDiscoverParams({ q: "dune", condition: "Good", distance: "10", sort: "distance", page: "2" }),
    ).toEqual({
      q: "dune",
      condition: "Good",
      distance: 10,
      sort: "distance",
      page: 2,
    });
    const junk = parseDiscoverParams({ condition: "Mint", distance: "-5", sort: "random", page: "abc" });
    expect(junk.condition).toBeUndefined();
    expect(junk.distance).toBeUndefined();
    expect(junk.sort).toBeUndefined();
    expect(junk.page).toBeUndefined();
  });
});
