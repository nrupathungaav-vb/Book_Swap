"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { Camera, ImagePlus, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { compressImage } from "@/lib/images/compress";
import { ACCEPT_ATTRIBUTE, checkImageMetadata } from "@/lib/images/validate";
import { cn } from "@/lib/utils";

export type PhotoValue =
  | { kind: "none" }
  | { kind: "existing"; url: string }
  | { kind: "new"; file: File; previewUrl: string };

/**
 * Photo of the physical book: file picker, drag & drop, mobile camera/gallery,
 * preview, replace, remove and upload progress.
 */
export function PhotoUploader({
  value,
  onChange,
  progress,
  disabled,
}: {
  value: PhotoValue;
  onChange: (value: PhotoValue) => void;
  progress: number | null;
  disabled?: boolean;
}) {
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Revoke object URLs we created.
  useEffect(() => {
    return () => {
      if (value.kind === "new") URL.revokeObjectURL(value.previewUrl);
    };
  }, [value]);

  const accept = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    // Early client check with generous size (phone photos get compressed below).
    const pre = checkImageMetadata({ name: file.name, type: file.type, size: Math.min(file.size, 1) });
    if (!pre.ok) {
      setError(pre.error);
      return;
    }
    setProcessing(true);
    const compressed = await compressImage(file);
    setProcessing(false);
    const check = checkImageMetadata(compressed);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    onChange({ kind: "new", file: compressed, previewUrl: URL.createObjectURL(compressed) });
  };

  const previewUrl = value.kind === "new" ? value.previewUrl : value.kind === "existing" ? value.url : null;
  const busy = disabled || processing || progress !== null;

  return (
    <div className="space-y-2">
      <input
        ref={fileInput}
        id={inputId}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          void accept(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          void accept(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {previewUrl ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative aspect-[3/4] w-40 overflow-hidden rounded-lg border bg-muted">
            <Image src={previewUrl} alt="Preview of your book photo" fill sizes="160px" className="object-cover" unoptimized />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>
              <RefreshCw aria-hidden /> Replace
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ kind: "none" })} disabled={busy}>
              <Trash2 aria-hidden /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!busy) void accept(event.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-card/60 px-6 py-8 text-center transition-colors",
            dragging && "border-primary bg-primary/5",
          )}
        >
          <UploadCloud className="size-8 text-primary" aria-hidden />
          <div>
            <p className="font-medium">Add a photo of your actual copy</p>
            <p className="text-sm text-muted-foreground">
              <span className="hidden sm:inline">Drag &amp; drop, or choose a file. </span>JPG, PNG or WebP.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>
              <ImagePlus aria-hidden /> Choose photo
            </Button>
            <Button type="button" variant="outline" size="sm" className="sm:hidden" onClick={() => cameraInput.current?.click()} disabled={busy}>
              <Camera aria-hidden /> Take photo
            </Button>
          </div>
        </div>
      )}

      {processing && <p className="text-sm text-muted-foreground" role="status">Preparing image…</p>}
      {progress !== null && (
        <div className="space-y-1" role="status" aria-live="polite">
          <Progress value={progress} aria-label="Upload progress" />
          <p className="text-xs text-muted-foreground">Uploading… {progress}%</p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
