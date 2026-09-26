import "server-only";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import type { BookContext } from "@/lib/gemini/prompts";

/** Loads the book through the caller's RLS-scoped client (only visible books). */
export async function loadBookContext(
  supabase: TypedSupabaseClient,
  bookId: string,
): Promise<BookContext | null> {
  const { data } = await supabase
    .from("books")
    .select("title, author, genre, description, isbn")
    .eq("id", bookId)
    .maybeSingle();
  return data;
}

export const AI_HOURLY_LIMIT = 30;
