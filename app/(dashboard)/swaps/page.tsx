import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { SwapCard } from "@/components/swaps/swap-card";
import { Button } from "@/components/ui/button";
import { requireUserOrRedirect } from "@/lib/auth/session";
import { loadSwapDetails } from "@/lib/swaps/queries";
import { createClient } from "@/lib/supabase/server";
import type { SwapDetails } from "@/types";

export const metadata: Metadata = { title: "Swaps" };

function Section({ id, title, swaps, userId, empty }: { id: string; title: string; swaps: SwapDetails[]; userId: string; empty?: string }) {
  if (swaps.length === 0 && !empty) return null;
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-xl font-semibold">
        {title} <span className="text-base font-normal text-muted-foreground">({swaps.length})</span>
      </h2>
      {swaps.length === 0 ? (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-3">
          {swaps.map((swap) => (
            <SwapCard key={swap.id} swap={swap} userId={userId} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function SwapsPage() {
  const user = await requireUserOrRedirect("/swaps");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("swap_requests")
    .select("*")
    .or(`requester_id.eq.${user.id},responder_id.eq.${user.id}`)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div>
        <PageHeader title="Swaps" />
        <ErrorState message="Your swaps couldn't be loaded." />
      </div>
    );
  }

  const swaps = await loadSwapDetails(supabase, data ?? []);
  const incoming = swaps.filter((s) => s.status === "Pending" && s.responder_id === user.id);
  const sent = swaps.filter((s) => s.status === "Pending" && s.requester_id === user.id);
  const active = swaps.filter((s) => s.status === "Accepted");
  const history = swaps.filter((s) => ["Completed", "Rejected", "Cancelled"].includes(s.status));

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Swaps" title="Your swaps" description="Reply to requests, coordinate active swaps, and look back at past exchanges." />
      {swaps.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No active swaps."
          description="Find a book you like and send a swap request — or check your mutual matches."
          action={
            <Button asChild>
              <Link href="/matches">See matches</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Section id="incoming" title="Waiting for your reply" swaps={incoming} userId={user.id} empty="No requests waiting for you." />
          <Section id="active" title="Active swaps" swaps={active} userId={user.id} empty="No active swaps." />
          <Section id="sent" title="Requests you sent" swaps={sent} userId={user.id} />
          <Section id="history" title="History" swaps={history} userId={user.id} />
        </>
      )}
    </div>
  );
}
