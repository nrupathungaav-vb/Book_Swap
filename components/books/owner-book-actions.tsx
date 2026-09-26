"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Pencil, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { relistBook, setBookHidden } from "@/actions/books";
import { Button } from "@/components/ui/button";
import type { BookStatus } from "@/types";

export function OwnerBookActions({
  bookId,
  status,
  hiddenByAdmin,
}: {
  bookId: string;
  status: BookStatus;
  hiddenByAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; message?: string; data?: unknown }>,
    after?: (data: unknown) => void,
  ) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }
      if (result.message) toast.success(result.message);
      after?.(result.data);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "Swapped" && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/books/${bookId}/edit`}>
            <Pencil aria-hidden /> Edit
          </Link>
        </Button>
      )}
      {status === "Available" && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run(() => setBookHidden(bookId, true))}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <EyeOff aria-hidden />} Hide
        </Button>
      )}
      {status === "Hidden" && !hiddenByAdmin && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run(() => setBookHidden(bookId, false))}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Eye aria-hidden />} Publish
        </Button>
      )}
      {status === "Swapped" && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => relistBook(bookId),
              (data) => {
                const id = (data as { id?: string } | undefined)?.id;
                if (id) router.push(`/books/${id}/edit`);
              },
            )
          }
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCw aria-hidden />} List a copy
          again
        </Button>
      )}
    </div>
  );
}
