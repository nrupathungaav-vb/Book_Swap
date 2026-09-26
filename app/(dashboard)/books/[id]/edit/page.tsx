import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookForm } from "@/components/books/book-form";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireUserOrRedirect } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validations/common";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const user = await requireUserOrRedirect(`/books/${id}/edit`);
  const supabase = await createClient();
  const { data: book } = await supabase.from("books").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!book) notFound();

  return (
    <div>
      <PageHeader eyebrow="Edit listing" title={book.title} />
      {book.status === "Swapped" ? (
        <Alert>
          <AlertDescription>This book has been swapped and is part of your swap history, so it can&apos;t be edited.</AlertDescription>
        </Alert>
      ) : (
        <BookForm book={book} />
      )}
    </div>
  );
}
