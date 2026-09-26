import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { validateImageBytes, TYPE_TO_EXTENSION } from "@/lib/images/validate";
import { handleRouteError, isSameOrigin, jsonError } from "@/lib/utils/api";
import { BOOK_IMAGES_BUCKET, bookImagePath, storagePathFromPublicUrl } from "@/lib/utils/storage";
import { uuidSchema } from "@/lib/validations/common";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

async function loadOwnBook(bookId: string) {
  const { user, supabase } = await requireUser();
  const { data: book } = await supabase
    .from("books")
    .select("id, user_id, status, cover_image_url")
    .eq("id", bookId)
    .eq("user_id", user.id)
    .maybeSingle();
  return { user, supabase, book };
}

/**
 * Upload / replace the photo of the physical book.
 * Validation happens here on the server (extension + declared type + magic
 * bytes + size); Storage RLS additionally pins the path to the owner's folder.
 */
export async function POST(request: Request, { params }: Params) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request blocked.", 403);
  const { id } = await params;
  const bookId = uuidSchema.safeParse(id);
  if (!bookId.success) return jsonError("Invalid book.", 400);

  try {
    const { user, supabase, book } = await loadOwnBook(bookId.data);
    if (!book) return jsonError("Book not found.", 404);
    if (book.status === "Swapped") return jsonError("Swapped books can't be changed.", 409);

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return jsonError("Choose an image to upload.", 400);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = validateImageBytes({ name: file.name, type: file.type, size: file.size }, bytes);
    if (!check.ok) return jsonError(check.error, 415);

    const path = bookImagePath(user.id, book.id, `${crypto.randomUUID()}.${TYPE_TO_EXTENSION[check.type]}`);
    const { error: uploadError } = await supabase.storage.from(BOOK_IMAGES_BUCKET).upload(path, bytes, {
      contentType: check.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) {
      console.error("[upload]", uploadError.message);
      return jsonError("Image upload failed. Please try again.", 502);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BOOK_IMAGES_BUCKET).getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("books")
      .update({ cover_image_url: publicUrl })
      .eq("id", book.id)
      .eq("user_id", user.id);
    if (updateError) {
      await supabase.storage.from(BOOK_IMAGES_BUCKET).remove([path]);
      return jsonError("Image upload failed. Please try again.", 500);
    }

    // Replacing: remove the previous object (only if it lives in our bucket).
    const previous = storagePathFromPublicUrl(book.cover_image_url, BOOK_IMAGES_BUCKET);
    if (previous && previous !== path && previous.startsWith(`${user.id}/`)) {
      await supabase.storage.from(BOOK_IMAGES_BUCKET).remove([previous]);
    }

    return NextResponse.json({ url: publicUrl }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Image upload failed.");
  }
}

/** Remove the photo (the listing falls back to the Google cover / placeholder). */
export async function DELETE(request: Request, { params }: Params) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request blocked.", 403);
  const { id } = await params;
  const bookId = uuidSchema.safeParse(id);
  if (!bookId.success) return jsonError("Invalid book.", 400);

  try {
    const { user, supabase, book } = await loadOwnBook(bookId.data);
    if (!book) return jsonError("Book not found.", 404);
    if (book.status === "Swapped") return jsonError("Swapped books can't be changed.", 409);

    const { error } = await supabase
      .from("books")
      .update({ cover_image_url: null })
      .eq("id", book.id)
      .eq("user_id", user.id);
    if (error) return jsonError("Couldn't remove the photo.", 500);

    const previous = storagePathFromPublicUrl(book.cover_image_url, BOOK_IMAGES_BUCKET);
    if (previous && previous.startsWith(`${user.id}/`)) {
      await supabase.storage.from(BOOK_IMAGES_BUCKET).remove([previous]);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Couldn't remove the photo.");
  }
}
