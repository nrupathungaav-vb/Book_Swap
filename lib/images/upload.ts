"use client";

/**
 * Uploads a file with real progress events (fetch() can't report upload
 * progress, XMLHttpRequest can).
 */
export function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append("file", file);
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      const response = (xhr.response ?? {}) as { url?: string; error?: string };
      if (xhr.status >= 200 && xhr.status < 300 && response.url) resolve({ ok: true, url: response.url });
      else resolve({ ok: false, error: response.error ?? "Image upload failed." });
    };
    xhr.onerror = () => resolve({ ok: false, error: "Image upload failed — check your connection." });
    xhr.onabort = () => resolve({ ok: false, error: "Upload cancelled." });
    xhr.send(body);
  });
}
