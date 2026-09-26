"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/images/compress";
import { uploadWithProgress } from "@/lib/images/upload";
import { ACCEPT_ATTRIBUTE, checkImageMetadata } from "@/lib/images/validate";
import { initials } from "@/lib/utils";

export function AvatarUploader({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(avatarUrl);
  const [progress, setProgress] = useState<number | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const compressed = await compressImage(file, 512, 0.85);
    const check = checkImageMetadata(compressed);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    if (compressed.size > 2 * 1024 * 1024) {
      toast.error("Avatars must be 2 MB or smaller.");
      return;
    }
    setProgress(0);
    const result = await uploadWithProgress("/api/profile/avatar", compressed, setProgress);
    setProgress(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPreview(result.url);
    toast.success("Avatar updated.");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-20 text-lg">
        {preview && <AvatarImage src={preview} alt="Your avatar" />}
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="space-y-1">
        <input
          ref={input}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={progress !== null}>
          {progress !== null ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
          {progress !== null ? `Uploading ${progress}%` : "Change avatar"}
        </Button>
        <p className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 2 MB.</p>
      </div>
    </div>
  );
}
