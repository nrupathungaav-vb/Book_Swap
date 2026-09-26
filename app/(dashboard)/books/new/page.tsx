import type { Metadata } from "next";
import { BookForm } from "@/components/books/book-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireUserOrRedirect } from "@/lib/auth/session";

export const metadata: Metadata = { title: "List a book" };

export default async function NewBookPage({ searchParams }: { searchParams: Promise<{ title?: string; author?: string }> }) {
  await requireUserOrRedirect("/books/new");
  const { title, author } = await searchParams;
  return (
    <div>
      <PageHeader eyebrow="New listing" title="List a book" description="Three quick steps: details, a photo of your copy, and its condition." />
      <BookForm prefill={{ title: title?.slice(0, 300), author: author?.slice(0, 200) }} />
    </div>
  );
}
