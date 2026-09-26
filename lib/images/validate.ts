/**
 * Image validation shared by the client (early feedback) and the upload route
 * (authoritative). The server never trusts the declared MIME type: it sniffs
 * the file signature ("magic bytes") and requires extension, declared type and
 * actual content to agree.
 */

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];
export const ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
export const ACCEPT_ATTRIBUTE = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

const EXTENSION_TO_TYPE: Record<string, AcceptedImageType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const TYPE_TO_EXTENSION: Record<AcceptedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/** Detects the real image type from the first bytes of the file. */
export function sniffImageType(bytes: Uint8Array): AcceptedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }
  return null;
}

export type ImageCheck = { ok: true; type: AcceptedImageType } | { ok: false; error: string };

/** Cheap checks available before reading the file (name, declared type, size). */
export function checkImageMetadata(file: { name: string; type: string; size: number }): ImageCheck {
  const ext = extensionOf(file.name);
  const typeFromExt = EXTENSION_TO_TYPE[ext];
  if (!typeFromExt) return { ok: false, error: "Use a JPG, PNG or WebP image." };
  if (file.type && !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Use a JPG, PNG or WebP image." };
  }
  if (file.size <= 0) return { ok: false, error: "That file is empty." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Images must be 4 MB or smaller." };
  return { ok: true, type: typeFromExt };
}

/** Full server-side validation: metadata + content signature must agree. */
export function validateImageBytes(
  file: { name: string; type: string; size: number },
  bytes: Uint8Array,
): ImageCheck {
  const meta = checkImageMetadata(file);
  if (!meta.ok) return meta;
  const actual = sniffImageType(bytes);
  if (!actual) return { ok: false, error: "That file isn't a valid image." };
  if (actual !== meta.type || (file.type && file.type !== actual)) {
    return { ok: false, error: "The file's contents don't match its type." };
  }
  return { ok: true, type: actual };
}
