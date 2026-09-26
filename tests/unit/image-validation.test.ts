import { describe, expect, it } from "vitest";
import {
  checkImageMetadata,
  MAX_IMAGE_BYTES,
  sniffImageType,
  validateImageBytes,
} from "@/lib/images/validate";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const HTML = new TextEncoder().encode("<html><script>alert(1)</script></html>");

describe("sniffImageType", () => {
  it("recognises JPEG, PNG and WebP signatures", () => {
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(WEBP)).toBe("image/webp");
    expect(sniffImageType(HTML)).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("checkImageMetadata", () => {
  it("validates extension, declared type and size", () => {
    expect(checkImageMetadata({ name: "a.JPG", type: "image/jpeg", size: 10 }).ok).toBe(true);
    expect(checkImageMetadata({ name: "a.gif", type: "image/gif", size: 10 }).ok).toBe(false);
    expect(checkImageMetadata({ name: "a.png", type: "application/pdf", size: 10 }).ok).toBe(false);
    expect(checkImageMetadata({ name: "a.png", type: "image/png", size: 0 }).ok).toBe(false);
    expect(checkImageMetadata({ name: "a.png", type: "image/png", size: MAX_IMAGE_BYTES + 1 }).ok).toBe(
      false,
    );
  });
});

describe("validateImageBytes — never trust the MIME type alone", () => {
  it("accepts consistent files", () => {
    expect(validateImageBytes({ name: "photo.webp", type: "image/webp", size: WEBP.length }, WEBP)).toEqual({
      ok: true,
      type: "image/webp",
    });
  });
  it("rejects HTML renamed to .jpg with an image MIME type", () => {
    const result = validateImageBytes({ name: "evil.jpg", type: "image/jpeg", size: HTML.length }, HTML);
    expect(result.ok).toBe(false);
  });
  it("rejects a PNG pretending to be a JPEG", () => {
    expect(validateImageBytes({ name: "x.jpg", type: "image/jpeg", size: PNG.length }, PNG).ok).toBe(false);
  });
});
