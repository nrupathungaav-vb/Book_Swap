export const BOOK_IMAGES_BUCKET = "book-covers";
export const AVATARS_BUCKET = "avatars";

/**
 * Extracts the object path from a Supabase public-storage URL for the given
 * bucket, or null if the URL doesn't point into that bucket.
 */
export function storagePathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  try {
    const { pathname } = new URL(url);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

export function bookImagePath(userId: string, bookId: string, fileName: string): string {
  return `${userId}/${bookId}/${fileName}`;
}
