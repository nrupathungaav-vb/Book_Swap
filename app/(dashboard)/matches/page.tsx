import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { MatchCard } from "@/components/matches/match-card";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { Stagger, StaggerItem } from "@/components/layout/motion";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireUserOrRedirect } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mutual matches" };

export default async function MatchesPage() {
  await requireUserOrRedirect("/matches");
  const supabase = await createClient();
  const { data: matches, error } = await supabase.rpc("get_my_matches");

  return (
    <div>
      <PageHeader
        eyebrow="Mutual matches"
        title="Swaps where you both win"
        description="Each match is a reader who wants one of your books and owns one on your wishlist. Matches update automatically."
      />
      {error ? (
        <ErrorState message="Your matches couldn't be loaded." />
      ) : !matches || matches.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No mutual matches yet."
          description="Matches appear when someone wants a book you've listed and has one on your wishlist. Listing more books and growing your wishlist helps."
          action={
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/wishlist">Grow your wishlist</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/books/new">List a book</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <Stagger className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" stagger={0.08}>
          {matches.map((match) => (
            <StaggerItem key={match.match_id}>
              <MatchCard match={match} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
