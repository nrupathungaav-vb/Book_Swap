"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftRight, BookPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { createSwapRequest } from "@/actions/swaps";
import { BookCover } from "@/components/books/book-cover";
import { Button, type ButtonProps } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { swapRequestSchema } from "@/lib/validations/swap";
import type { Book } from "@/types";

type OwnBook = Pick<Book, "id" | "title" | "author" | "cover_image_url" | "google_cover_url">;
type FormInput = z.input<typeof swapRequestSchema>;
type FormOutput = z.output<typeof swapRequestSchema>;

export function RequestSwapButton({
  book,
  preselectedOfferId,
  disabled,
  size = "default",
  className,
  label = "Request swap",
}: {
  book: { id: string; title: string; author: string };
  preselectedOfferId?: string;
  disabled?: boolean;
  size?: ButtonProps["size"];
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [myBooks, setMyBooks] = useState<OwnBook[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(swapRequestSchema),
    defaultValues: { requestedBookId: book.id, offeredBookId: preselectedOfferId ?? "", note: "" },
  });

  const loadMyBooks = useCallback(async () => {
    setLoadError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/books/${book.id}`)}`);
      return;
    }
    const { data, error } = await supabase
      .from("books")
      .select("id, title, author, cover_image_url, google_cover_url")
      .eq("user_id", user.id)
      .eq("status", "Available")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError("Couldn't load your books.");
      return;
    }
    setMyBooks(data);
    if (!form.getValues("offeredBookId") && data[0]) form.setValue("offeredBookId", data[0].id);
  }, [book.id, form, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await createSwapRequest(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Swap request sent!");
    setOpen(false);
    router.push(`/swaps/${result.data.id}`);
  });

  const selected = form.watch("offeredBookId");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void loadMyBooks();
      }}
    >
      <DialogTrigger asChild>
        <Button size={size} className={className} disabled={disabled} title={disabled ? "This book isn't available right now" : undefined}>
          <ArrowLeftRight aria-hidden /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Swap for “{book.title}”</DialogTitle>
          <DialogDescription>Choose one of your available books to offer in return.</DialogDescription>
        </DialogHeader>

        {!myBooks && !loadError && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Loading your shelf…
          </p>
        )}
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}

        {myBooks && myBooks.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="font-medium">You don&apos;t have any available books to offer yet.</p>
            <Button asChild className="mt-3">
              <Link href="/books/new">
                <BookPlus aria-hidden /> List a book
              </Link>
            </Button>
          </div>
        )}

        {myBooks && myBooks.length > 0 && (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Your book to offer</legend>
              <div role="radiogroup" className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                {myBooks.map((own) => (
                  <label
                    key={own.id}
                    className={cn(
                      "cursor-pointer rounded-lg border-2 border-transparent p-1 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      selected === own.id && "border-primary bg-primary/5",
                    )}
                  >
                    <input type="radio" value={own.id} className="sr-only" {...form.register("offeredBookId")} />
                    <BookCover book={own} sizes="120px" className="rounded-md" />
                    <span className="mt-1 line-clamp-2 block text-xs font-medium">{own.title}</span>
                  </label>
                ))}
              </div>
              {form.formState.errors.offeredBookId && (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  {form.formState.errors.offeredBookId.message}
                </p>
              )}
            </fieldset>
            <FormField id="swap-note" label="Add a note (optional)" error={form.formState.errors.note?.message}>
              <Textarea rows={3} maxLength={500} placeholder="Hi! I'm usually free on weekends near the city library." {...form.register("note")} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Send request
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
