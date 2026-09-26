"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminSetBookVisibility, updateReportStatus } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BookStatus, ReportStatus } from "@/types";

export function ReportActions({
  reportId,
  status,
  book,
}: {
  reportId: string;
  status: ReportStatus;
  book: { id: string; status: BookStatus; hiddenByAdmin: boolean } | null;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) toast.error(result.error ?? "Failed.");
      else {
        toast.success(result.message ?? "Done.");
        router.refresh();
      }
    });

  const closed = status === "Resolved" || status === "Dismissed";

  return (
    <div className="space-y-2">
      {!closed && (
        <>
          <label htmlFor={`notes-${reportId}`} className="sr-only">
            Moderator notes
          </label>
          <Textarea
            id={`notes-${reportId}`}
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Moderator notes (optional, private)"
          />
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "Open" && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => updateReportStatus(reportId, "Reviewing", notes))}
          >
            Start review
          </Button>
        )}
        {!closed && (
          <>
            <Button
              size="sm"
              variant="forest"
              disabled={pending}
              onClick={() => run(() => updateReportStatus(reportId, "Resolved", notes))}
            >
              Resolve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => run(() => updateReportStatus(reportId, "Dismissed", notes))}
            >
              Dismiss
            </Button>
          </>
        )}
        {closed && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(() => updateReportStatus(reportId, "Open", null))}
          >
            Reopen
          </Button>
        )}
        {book && book.status === "Available" && (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => run(() => adminSetBookVisibility(book.id, true))}
          >
            <EyeOff aria-hidden /> Hide book
          </Button>
        )}
        {book && book.status === "Hidden" && book.hiddenByAdmin && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => adminSetBookVisibility(book.id, false))}
          >
            <Eye aria-hidden /> Restore book
          </Button>
        )}
        {pending && <Loader2 className="size-4 animate-spin self-center" aria-label="Working" />}
      </div>
    </div>
  );
}
