"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { friendlyDbError, toActionError } from "@/lib/utils/errors";
import { uuidSchema } from "@/lib/validations/common";
import { wishlistSchema, type WishlistInput } from "@/lib/validations/wishlist";
import type { ActionResult, Wishlist } from "@/types";

function revalidateWishlist() {
  revalidatePath("/wishlist");
  revalidatePath("/matches");
  revalidatePath("/discover");
  revalidatePath("/dashboard");
}

export async function addWishlistItem(input: WishlistInput): Promise<ActionResult<Wishlist>> {
  const parsed = wishlistSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase
      .from("wishlists")
      .insert({ user_id: user.id, title: parsed.data.title, author: parsed.data.author })
      .select("*")
      .single();
    if (error || !data) return { ok: false, error: friendlyDbError(error, "Couldn't add that book.") };
    revalidateWishlist();
    return { ok: true, data, message: `"${data.title}" added to your wishlist.` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeWishlistItem(id: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid item." };
  try {
    const { user, supabase } = await requireUser();
    const { error } = await supabase.from("wishlists").delete().eq("id", parsed.data).eq("user_id", user.id);
    if (error) return { ok: false, error: friendlyDbError(error, "Couldn't remove that item.") };
    revalidateWishlist();
    return { ok: true, data: undefined, message: "Removed from your wishlist." };
  } catch (error) {
    return toActionError(error);
  }
}

/** Adds/removes a listed book's title+author to/from the wishlist (discover heart button). */
export async function toggleWishlistForBook(bookId: string): Promise<ActionResult<{ inWishlist: boolean }>> {
  const parsed = uuidSchema.safeParse(bookId);
  if (!parsed.success) return { ok: false, error: "Invalid book." };
  try {
    const { user, supabase } = await requireUser();
    const { data: book } = await supabase
      .from("books")
      .select("title, author, user_id, title_norm, author_norm")
      .eq("id", parsed.data)
      .maybeSingle();
    if (!book) return { ok: false, error: "Book not found." };
    if (book.user_id === user.id) return { ok: false, error: "That's your own book." };

    const { data: existing } = await supabase
      .from("wishlists")
      .select("id, author_norm")
      .eq("user_id", user.id)
      .eq("title_norm", book.title_norm);
    // Same rule the database uses for matching (normalised columns computed in Postgres).
    const matching = (existing ?? []).filter(
      (item) => item.author_norm === "" || item.author_norm === book.author_norm,
    );

    if (matching.length > 0) {
      const { error } = await supabase
        .from("wishlists")
        .delete()
        .in(
          "id",
          matching.map((item) => item.id),
        )
        .eq("user_id", user.id);
      if (error) return { ok: false, error: friendlyDbError(error) };
      revalidateWishlist();
      return { ok: true, data: { inWishlist: false }, message: "Removed from your wishlist." };
    }

    const { error } = await supabase
      .from("wishlists")
      .insert({ user_id: user.id, title: book.title, author: book.author });
    if (error) return { ok: false, error: friendlyDbError(error) };
    revalidateWishlist();
    return { ok: true, data: { inWishlist: true }, message: "Added to your wishlist." };
  } catch (error) {
    return toActionError(error);
  }
}
