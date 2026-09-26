"use client";

/**
 * Downscales large phone photos in the browser before upload (max 1600px,
 * WebP at 0.85). Keeps uploads fast and under the 4 MB server limit. Falls
 * back to the original file if the browser can't encode WebP.
 */
export async function compressImage(file: File, maxDimension = 1600, quality = 0.85): Promise<File> {
  if (typeof window === "undefined" || !("createImageBitmap" in window)) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "book-photo";
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}
