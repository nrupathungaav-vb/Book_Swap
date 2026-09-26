"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { createBook, updateBook } from "@/actions/books";
import { GoogleBooksSearch } from "@/components/books/google-books-search";
import { PhotoUploader, type PhotoValue } from "@/components/books/photo-uploader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { uploadWithProgress } from "@/lib/images/upload";
import { bookSchema } from "@/lib/validations/book";
import { BOOK_CONDITIONS, type Book, type GoogleBook } from "@/types";

type FormInput = z.input<typeof bookSchema>;
type FormOutput = z.output<typeof bookSchema>;

const CONDITION_HELP: Record<(typeof BOOK_CONDITIONS)[number], string> = {
  New: "Unread or like new",
  Good: "Light wear, clean pages",
  Fair: "Visible wear, fully readable",
  Poor: "Heavy wear — a reading copy",
};

export function BookForm({
  book,
  prefill,
}: {
  /** Present when editing. */
  book?: Pick<
    Book,
    | "id"
    | "title"
    | "author"
    | "genre"
    | "condition"
    | "description"
    | "google_books_id"
    | "google_cover_url"
    | "isbn"
    | "cover_image_url"
    | "status"
  >;
  prefill?: { title?: string; author?: string };
}) {
  const router = useRouter();
  const editing = Boolean(book);
  const [photo, setPhoto] = useState<PhotoValue>(
    book?.cover_image_url ? { kind: "existing", url: book.cover_image_url } : { kind: "none" },
  );
  const [progress, setProgress] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      title: book?.title ?? prefill?.title ?? "",
      author: book?.author ?? prefill?.author ?? "",
      genre: book?.genre ?? "",
      condition: book?.condition ?? "Good",
      description: book?.description ?? "",
      googleBooksId: book?.google_books_id ?? "",
      googleCoverUrl: book?.google_cover_url ?? "",
      isbn: book?.isbn ?? "",
      publish: true,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const googleCover = form.watch("googleCoverUrl");
  const googleId = form.watch("googleBooksId");

  /** Google metadata fills the text fields only — the photo is never touched. */
  const applyGoogleBook = (g: GoogleBook) => {
    const opts = { shouldDirty: true, shouldValidate: true } as const;
    form.setValue("title", g.title.slice(0, 300), opts);
    form.setValue("author", (g.authors.join(", ") || form.getValues("author") || "").slice(0, 200), opts);
    if (g.categories[0]) form.setValue("genre", g.categories[0].slice(0, 100), opts);
    if (g.description) form.setValue("description", g.description.slice(0, 4000), opts);
    form.setValue("isbn", g.isbn ?? "", opts);
    form.setValue("googleBooksId", g.googleBooksId, opts);
    form.setValue("googleCoverUrl", g.thumbnailUrl ?? "", opts);
    toast.success("Details filled in from Google Books — review them before publishing.");
  };

  const clearGoogle = () => {
    form.setValue("googleBooksId", "", { shouldDirty: true });
    form.setValue("googleCoverUrl", "", { shouldDirty: true });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    const result = book ? await updateBook(book.id, values) : await createBook(values);
    if (!result.ok) {
      setSubmitError(result.error);
      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          if (messages?.[0]) form.setError(field as keyof FormInput, { message: messages[0] });
        }
      }
      return;
    }
    const bookId = result.data.id;

    if (photo.kind === "new") {
      setProgress(0);
      const upload = await uploadWithProgress(`/api/books/${bookId}/image`, photo.file, setProgress);
      setProgress(null);
      if (!upload.ok) {
        toast.error(
          `${editing ? "Book updated" : "Book listed"}, but the photo didn't upload: ${upload.error}`,
        );
        router.push(`/books/${bookId}/edit`);
        router.refresh();
        return;
      }
    } else if (photo.kind === "none" && book?.cover_image_url) {
      const res = await fetch(`/api/books/${bookId}/image`, { method: "DELETE" });
      if (!res.ok) toast.error("Couldn't remove the old photo.");
    }

    toast.success(result.message ?? "Saved.");
    router.push(`/books/${bookId}`);
    router.refresh();
  });

  const busy = isSubmitting || progress !== null;

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]" noValidate>
      <div className="space-y-6">
        {submitError && (
          <Alert variant="destructive">
            <Info aria-hidden />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>1 · Book details</CardTitle>
            <CardDescription>
              Search Google Books to autofill, then adjust anything that doesn&apos;t match your copy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <GoogleBooksSearch onSelect={applyGoogleBook} />

            {googleId && (
              <div className="bg-muted/50 flex items-center gap-3 rounded-lg border p-3 text-sm">
                {googleCover ? (
                  <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded">
                    <Image src={googleCover} alt="" fill sizes="40px" className="object-cover" />
                  </div>
                ) : null}
                <p className="text-muted-foreground flex-1">
                  Linked to Google Books. The publisher cover is only a fallback — your photo always takes
                  priority.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={clearGoogle}
                  aria-label="Unlink Google Books"
                >
                  <X aria-hidden />
                </Button>
              </div>
            )}

            <FormField id="title" label="Title" required error={errors.title?.message}>
              <Input maxLength={300} {...form.register("title")} />
            </FormField>
            <FormField id="author" label="Author" required error={errors.author?.message}>
              <Input maxLength={200} {...form.register("author")} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="genre" label="Genre" error={errors.genre?.message}>
                <Input maxLength={100} placeholder="e.g. Fantasy" {...form.register("genre")} />
              </FormField>
              <FormField id="isbn" label="ISBN" error={errors.isbn?.message}>
                <Input inputMode="numeric" maxLength={17} {...form.register("isbn")} />
              </FormField>
            </div>
            <FormField
              id="description"
              label="Description"
              description="Mention anything specific to your copy: edition, notes, wear."
              error={errors.description?.message}
            >
              <Textarea rows={5} maxLength={4000} {...form.register("description")} />
            </FormField>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>2 · Photo of your copy</CardTitle>
            <CardDescription>Readers want to see the actual book they&apos;ll receive.</CardDescription>
          </CardHeader>
          <CardContent>
            <PhotoUploader value={photo} onChange={setPhoto} progress={progress} disabled={isSubmitting} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3 · Condition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset>
              <legend className="sr-only">Condition</legend>
              <div className="grid grid-cols-2 gap-2">
                {BOOK_CONDITIONS.map((condition) => (
                  <label
                    key={condition}
                    className="has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-ring flex cursor-pointer flex-col rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <input
                        type="radio"
                        value={condition}
                        className="accent-[var(--primary)]"
                        {...form.register("condition")}
                      />
                      {condition}
                    </span>
                    <span className="text-muted-foreground mt-1 text-xs">{CONDITION_HELP[condition]}</span>
                  </label>
                ))}
              </div>
              {errors.condition && (
                <p role="alert" className="text-destructive mt-2 text-xs">
                  {errors.condition.message}
                </p>
              )}
            </fieldset>

            {!editing && (
              <FormField id="publish" label="Visibility">
                <NativeSelect
                  defaultValue="true"
                  onChange={(event) => form.setValue("publish", event.target.value === "true")}
                >
                  <option value="true">Publish now — visible to other readers</option>
                  <option value="false">Save hidden — publish later</option>
                </NativeSelect>
              </FormField>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" size="lg" className="flex-1" disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {progress !== null ? "Uploading photo…" : editing ? "Save changes" : "Publish listing"}
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={() => router.back()} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
