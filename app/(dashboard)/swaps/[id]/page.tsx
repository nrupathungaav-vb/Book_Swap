import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, BookPlus, PartyPopper } from "lucide-react";
import { BookCover } from "@/components/books/book-cover";
import { SwapStatusBadge } from "@/components/books/status-badges";
import { SwapActions } from "@/components/swaps/swap-actions";
import { SwapLiveRefresh } from "@/components/swaps/swap-live-refresh";
import { SwapWorkspace } from "@/components/swaps/swap-workspace";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getCurrentProfile, requireUserOrRedirect } from "@/lib/auth/session";
import { availableSwapActions } from "@/lib/swaps/status";
import { getSwap } from "@/lib/swaps/queries";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validations/common";

export const metadata: Metadata = { title: "Swap workspace" };

export default async function SwapWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const user = await requireUserOrRedirect(`/swaps/${id}`);
  const supabase = await createClient();

  // RLS returns nothing unless the caller is a participant (or admin).
  const swap = await getSwap(supabase, id);
  if (!swap || (swap.requester_id !== user.id && swap.responder_id !== user.id)) notFound();

  const [{ data: messages, error: messagesError }, { data: meetings }, profile] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("swap_request_id", id)
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("meeting_locations")
      .select("*")
      .eq("swap_request_id", id)
      .order("created_at", { ascending: false }),
    getCurrentProfile(),
  ]);

  const iAmRequester = swap.requester_id === user.id;
  const me = iAmRequester ? swap.requester : swap.responder;
  const other = iAmRequester ? swap.responder : swap.requester;
  const give = iAmRequester ? swap.offered_book : swap.requested_book;
  const get = iAmRequester ? swap.requested_book : swap.offered_book;
  const actions = availableSwapActions(swap, user.id);
  const defaultCenter =
    profile?.geo_lat != null && profile.geo_lng != null
      ? { lat: profile.geo_lat, lng: profile.geo_lng }
      : null;

  return (
    <div className="space-y-6">
      <SwapLiveRefresh swapId={swap.id} />
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/swaps">
          <ArrowLeft aria-hidden /> All swaps
        </Link>
      </Button>

      <section aria-labelledby="swap-heading" className="bg-card rounded-2xl border p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <Link href={`/books/${give.id}`} className="w-20 sm:w-24">
              <BookCover book={give} sizes="96px" />
            </Link>
            <ArrowLeftRight className="text-amber size-6 shrink-0" aria-label="swapped for" />
            <Link href={`/books/${get.id}`} className="w-20 sm:w-24">
              <BookCover book={get} sizes="96px" />
            </Link>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <SwapStatusBadge status={swap.status} />
              {swap.status === "Accepted" && (
                <span className="text-muted-foreground text-xs">
                  Confirmed by:{" "}
                  {[
                    swap.requester_completed && swap.requester.full_name,
                    swap.responder_completed && swap.responder.full_name,
                  ]
                    .filter(Boolean)
                    .join(", ") || "no one yet"}
                </span>
              )}
            </div>
            <h1 id="swap-heading" className="text-xl leading-snug font-semibold sm:text-2xl">
              You give <span className="text-primary">“{give.title}”</span> · you get{" "}
              <span className="text-forest">“{get.title}”</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              Swapping with{" "}
              <span className="text-foreground font-medium">{other.full_name ?? "a reader"}</span>
              {other.location_city ? ` from ${other.location_city}` : ""}.
            </p>
            {swap.note && <p className="text-sm italic">“{swap.note}”</p>}
          </div>
          <SwapActions swap={swap} userId={user.id} />
        </div>
      </section>

      {swap.status === "Completed" && (
        <Alert variant="success">
          <PartyPopper aria-hidden />
          <AlertTitle>Swap completed — happy reading!</AlertTitle>
          <AlertDescription>
            <p>Done with “{get.title}” one day? Pass it on.</p>
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link
                href={`/books/new?title=${encodeURIComponent(get.title)}&author=${encodeURIComponent(get.author)}`}
              >
                <BookPlus aria-hidden /> List it on BookSwap
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {swap.status === "Pending" && (
        <Alert variant="info">
          <AlertDescription>
            {iAmRequester
              ? `Waiting for ${other.full_name ?? "the owner"} to respond. You can already chat.`
              : "Accepting will reserve both books so nobody else can take them."}
          </AlertDescription>
        </Alert>
      )}

      <SwapWorkspace
        swapId={swap.id}
        me={me}
        other={other}
        messages={messages ?? []}
        messagesError={Boolean(messagesError)}
        meetings={meetings ?? []}
        canChat={actions.canChat}
        canArrange={actions.canArrangeMeeting}
        defaultCenter={defaultCenter}
      />
    </div>
  );
}
