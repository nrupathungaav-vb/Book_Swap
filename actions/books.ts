"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { friendlyDbError, toActionError } from "@/lib/utils/errors";
import { bookSchema, bookVisibilitySchema, type BookInput } from "@/lib/validations/book";
import { uuidSchema } from "@/lib/validations/common";
import type { ActionResult } from "@/types";

function revalidateBooks(bookId?: string) {
  revalidatePath("/books");
  revalidatePath("/discover");
  revalidatePath("/dashboard");
  revalidatePath("/matches");
  if (bookId) revalidatePath(`/books/${bookId}`);
}

export async function createBook(input: BookInput): Promise<ActionResult<{ id: string }>> {
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const { user, supabase } = await requireUser();
    const book = parsed.data;
    const { data, error } = await supabase
      .from("books")
      .insert({
        user_id: user.id,
        title: book.title,
        author: book.author,
        genre: book.genre,
        condition: book.condition,
        description: book.description,
        google_books_id: book.googleBooksId,
        google_cover_url: book.googleCoverUrl,
        isbn: book.isbn,
        status: book.publish ? "Available" : "Hidden",
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: friendlyDbError(error, "Book could not be created.") };
    revalidateBooks(data.id);
    return { ok: true, data: { id: data.id }, message: "Book listed." };
  } catch (error) {
    return toActionError(error, "Book could not be created.");
  }
}

export async function updateBook(bookId: string, input: BookInput): Promise<ActionResult<{ id: string }>> {
  const id = uuidSchema.safeParse(bookId);
  const parsed = bookSchema.safeParse(input);
  if (!id.success) return { ok: false, error: "Invalid book." };
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const { user, supabase } = await requireUser();
    const book = parsed.data;
    // cover_image_url (the owner's photo) is deliberately NOT part of this update:
    // Google metadata can never overwrite the uploaded physical photo.
    const { data, error } = await supabase
      .from("books")
      .update({
        title: book.title,
        author: book.author,
        genre: book.genre,
        condition: book.condition,
        description: book.description,
        google_books_id: book.googleBooksId,
        google_cover_url: book.googleCoverUrl,
        isbn: book.isbn,
      })
      .eq("id", id.data)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: friendlyDbError(error, "Book could not be updated.") };
    if (!data) return { ok: false, error: "Book not found." };
    revalidateBooks(data.id);
    return { ok: true, data: { id: data.id }, message: "Book updated." };
  } catch (error) {
    return toActionError(error, "Book could not be updated.");
  }
}

/** Soft delete / restore. Books are never physically deleted (swap history). */
export async function setBookHidden(bookId: string, hidden: boolean): Promise<ActionResult> {
  const parsed = bookVisibilitySchema.safeParse({ bookId, hidden });
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase
      .from("books")
      .update({ status: hidden ? "Hidden" : "Available" })
      .eq("id", parsed.data.bookId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: friendlyDbError(error, "Couldn't update the listing.") };
    if (!data) return { ok: false, error: "Book not found." };
    revalidateBooks(parsed.data.bookId);
    return { ok: true, data: undefined, message: hidden ? "Listing hidden." : "Listing is live again." };
  } catch (error) {
    return toActionError(error);
  }
}

/** Creates a fresh Available listing from a Swapped/own book (history stays intact). */
export async function relistBook(bookId: string): Promise<ActionResult<{ id: string }>> {
  const id = uuidSchema.safeParse(bookId);
  if (!id.success) return { ok: false, error: "Invalid book." };
  try {
    const { user, supabase } = await requireUser();
    const { data: original, error: readError } = await supabase
      .from("books")
      .select(
        "title, author, genre, condition, description, google_books_id, google_cover_url, isbn, status, user_id",
      )
      .eq("id", id.data)
      .maybeSingle();
    if (readError || !original) return { ok: false, error: "Book not found." };
    if (original.user_id !== user.id || original.status !== "Swapped") {
      return { ok: false, error: "Only your swapped books can be re-listed this way." };
    }
    const { data, error } = await supabase
      .from("books")
      .insert({
        user_id: user.id,
        title: original.title,
        author: original.author,
        genre: original.genre,
        condition: original.condition,
        description: original.description,
        google_books_id: original.google_books_id,
        google_cover_url: original.google_cover_url,
        isbn: original.isbn,
        status: "Available",
      })
      .select("id")
      .single();
    if (error || !data)
      return { ok: false, error: friendlyDbError(error, "Couldn't create the new listing.") };
    revalidateBooks(data.id);
    return { ok: true, data: { id: data.id }, message: "Listed again — add a fresh photo." };
  } catch (error) {
    return toActionError(error);
  }
}
