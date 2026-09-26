import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ReportActions } from "@/components/admin/report-actions";
import { BookCover } from "@/components/books/book-cover";
import { BookStatusBadge } from "@/components/books/status-badges";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { formatRelativeTime } from "@/lib/utils";
import { uuidSchema } from "@/lib/validations/common";

export const metadata: Metadata = { title: "Review user" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { supabase } = await requireAdmin();

  const [{ data: rows }, { data: books }, { data: reports }] = await Promise.all([
    supabase.rpc("admin_get_user", { p_user_id: id }),
    supabase.from("books").select("*").eq("user_id", id).order("created_at", { ascending: false }),
    supabase
      .from("reports")
      .select("*")
      .eq("reported_user_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const person = rows?.[0];
  if (!person) notFound();

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin">
          <ArrowLeft aria-hidden /> Reports
        </Link>
      </Button>
      <PageHeader
        eyebrow="Review user"
        title={person.full_name ?? "Unnamed reader"}
        description={`${person.email ?? "no email"} · ${person.location_city ?? "no city"} · joined ${formatRelativeTime(person.created_at)}`}
      />
      <dl className="grid grid-cols-3 gap-3">
        {[
          ["Books listed", person.books_count],
          ["Reports against", person.reports_against],
          ["Completed swaps", person.completed_swaps],
        ].map(([label, value]) => (
          <div key={label} className="bg-card rounded-xl border p-4">
            <dt className="text-muted-foreground text-sm">{label}</dt>
            <dd className="font-serif text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="user-books" className="space-y-3">
        <h2 id="user-books" className="text-xl font-semibold">
          Listings
        </h2>
        {(books ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">No books.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {(books ?? []).map((book) => (
              <li key={book.id} className="bg-card flex gap-3 rounded-xl border p-3">
                <div className="w-16 shrink-0">
                  <BookCover book={book} sizes="64px" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Link
                    href={`/books/${book.id}`}
                    className="line-clamp-1 font-serif font-semibold hover:underline"
                  >
                    {book.title}
                  </Link>
                  <BookStatusBadge status={book.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="user-reports" className="space-y-3">
        <h2 id="user-reports" className="text-xl font-semibold">
          Reports about this user
        </h2>
        {(reports ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">None.</p>
        ) : (
          <ul className="space-y-3">
            {(reports ?? []).map((report) => (
              <li key={report.id} className="bg-card space-y-2 rounded-xl border p-3 text-sm">
                <p>
                  <span className="font-medium">{report.reason}</span> · {report.status} ·{" "}
                  {formatRelativeTime(report.created_at)}
                </p>
                {report.description && <p className="text-muted-foreground">{report.description}</p>}
                <ReportActions reportId={report.id} status={report.status} book={null} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
