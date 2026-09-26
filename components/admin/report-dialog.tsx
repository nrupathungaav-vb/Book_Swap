"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { createReport } from "@/actions/reports";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { reportSchema } from "@/lib/validations/report";
import { REPORT_REASONS } from "@/types/database";

type FormInput = z.input<typeof reportSchema>;
type FormOutput = z.output<typeof reportSchema>;

export function ReportButton({
  target,
  bookId,
  userId,
  label,
}: {
  target: "book" | "user";
  bookId?: string;
  userId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reportedBookId: bookId ?? null,
      reportedUserId: target === "user" ? (userId ?? null) : null,
      reason: undefined,
      description: "",
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await createReport(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Report sent.");
    form.reset();
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Flag aria-hidden /> {label ?? (target === "book" ? "Report listing" : "Report user")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{target === "book" ? "Report this listing" : "Report this reader"}</DialogTitle>
          <DialogDescription>Reports are private. A moderator will review it; the other person won&apos;t see who reported.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField id="report-reason" label="Reason" required error={errors.reason?.message}>
            <NativeSelect defaultValue="" {...form.register("reason")}>
              <option value="" disabled>
                Choose a reason…
              </option>
              {REPORT_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="report-description" label="Details (optional)" error={errors.description?.message}>
            <Textarea rows={4} maxLength={1000} placeholder="What happened?" {...form.register("description")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Send report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
