import type { Metadata } from "next";
import Link from "next/link";
import { Flag, ShieldCheck } from "lucide-react";
import { ReportActions } from "@/components/admin/report-actions";
import { BookCover } from "@/components/books/book-cover";
import { BookStatusBadge } from "@/components/books/status-badges";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/session";
import { cn, formatRelativeTime } from "@/lib/utils";
import { REPORT_STATUSES, type ReportStatus } from "@/types";

export const metadata: Metadata = { title: "Moderation" };

const STATUS_VARIANT: Record<ReportStatus, "amber" | "secondary" | "forest" | "muted"> = {
  Open: "amber",
  Reviewing: "secondary",
  Resolved: "forest",
  Dismissed: "muted",
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase } = await requireAdmin();
  const { status: rawStatus } = await searchParams;
  const status = (REPORT_STATUSES as readonly string[]).includes(rawStatus ?? "")
    ? (rawStatus as ReportStatus)
    : null;

  let query = supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
  query = status ? query.eq("status", status) : query.in("status", ["Open", "Reviewing"]);
  const { data: reports, error } = await query;

  const bookIds = [
    ...new Set((reports ?? []).map((r) => r.reported_book_id).filter((id): id is string => Boolean(id))),
  ];
  const userIds = [
    ...new Set(
      (reports ?? [])
        .flatMap((r) => [r.reported_user_id, r.reporter_id])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const [{ data: books }, { data: people }, { count: openCount }] = await Promise.all([
    bookIds.length ? supabase.from("books").select("*").in("id", bookIds) : Promise.resolve({ data: [] }),
    userIds.length
      ? supabase.from("public_profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "Open"),
  ]);
  const bookById = new Map((books ?? []).map((b) => [b.id, b]));
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name ?? "A reader"]));

  const filters: { label: string; value: ReportStatus | null }[] = [
    { label: "Needs attention", value: null },
    ...REPORT_STATUSES.map((s) => ({ label: s, value: s })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Moderation"
        title="Reports"
        description={`${openCount ?? 0} open report${openCount === 1 ? "" : "s"}.`}
      />
      <nav aria-label="Filter reports" className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/admin?status=${filter.value}` : "/admin"}
            aria-current={status === filter.value ? "page" : undefined}
            className={cn(
              "hover:bg-accent rounded-full border px-3 py-1 text-sm transition-colors",
              status === filter.value && "border-primary bg-primary/10 font-medium",
            )}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <ErrorState message="Reports couldn't be loaded." />
      ) : !reports || reports.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing to review"
          description="No reports match this filter."
        />
      ) : (
        <ul className="space-y-4">
          {reports.map((report) => {
            const book = report.reported_book_id ? bookById.get(report.reported_book_id) : undefined;
            return (
              <li key={report.id} className="bg-card rounded-2xl border p-4 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row">
                  {book && (
                    <Link href={`/books/${book.id}`} className="w-20 shrink-0">
                      <BookCover book={book} sizes="80px" />
                    </Link>
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_VARIANT[report.status]}>{report.status}</Badge>
                      <Badge variant="outline">
                        <Flag aria-hidden /> {report.reason}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {formatRelativeTime(report.created_at)}
                      </span>
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Reported by</span>{" "}
                      {nameById.get(report.reporter_id) ?? "A reader"}
                      {report.reported_user_id && (
                        <>
                          {" · "}
                          <span className="text-muted-foreground">about</span>{" "}
                          <Link
                            href={`/admin/users/${report.reported_user_id}`}
                            className="font-medium underline"
                          >
                            {nameById.get(report.reported_user_id) ?? "user"}
                          </Link>
                        </>
                      )}
                    </p>
                    {book && (
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-serif font-semibold">{book.title}</span>
                        <BookStatusBadge status={book.status} />
                      </p>
                    )}
                    {report.description && (
                      <p className="bg-muted rounded-lg p-3 text-sm">{report.description}</p>
                    )}
                    {report.admin_notes && (
                      <p className="text-muted-foreground text-xs">Notes: {report.admin_notes}</p>
                    )}
                    <ReportActions
                      reportId={report.id}
                      status={report.status}
                      book={
                        book
                          ? { id: book.id, status: book.status, hiddenByAdmin: book.hidden_by_admin }
                          : null
                      }
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
