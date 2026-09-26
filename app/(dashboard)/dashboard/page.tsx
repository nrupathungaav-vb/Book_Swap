import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Bell, BookOpen, BookPlus, Compass, Heart, MapPin, Sparkles } from "lucide-react";
import { BookCard } from "@/components/books/book-card";
import { FadeIn, Stagger, StaggerItem } from "@/components/layout/motion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getCurrentProfile, requireUserOrRedirect } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUserOrRedirect("/dashboard");
  const [profile, supabase] = await Promise.all([getCurrentProfile(), createClient()]);

  const [books, wishlist, activeSwaps, pendingForMe, matches, unread, recent] = await Promise.all([
    supabase.from("books").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["Available", "Reserved"]),
    supabase.from("wishlists").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase
      .from("swap_requests")
      .select("id", { count: "exact", head: true })
      .or(`requester_id.eq.${user.id},responder_id.eq.${user.id}`)
      .in("status", ["Pending", "Accepted"]),
    supabase.from("swap_requests").select("id", { count: "exact", head: true }).eq("responder_id", user.id).eq("status", "Pending"),
    supabase.from("matches").select("id", { count: "exact", head: true }),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false),
    supabase.rpc("discover_books", { p_limit: 4, p_sort: "newest" }),
  ]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "reader";
  const stats = [
    { label: "Books listed", value: books.count ?? 0, href: "/books", icon: BookOpen },
    { label: "Wishlist", value: wishlist.count ?? 0, href: "/wishlist", icon: Heart },
    { label: "Active swaps", value: activeSwaps.count ?? 0, href: "/swaps", icon: ArrowLeftRight },
    { label: "Mutual matches", value: matches.count ?? 0, href: "/matches", icon: Sparkles },
    { label: "Unread notifications", value: unread.count ?? 0, href: "/notifications", icon: Bell },
  ];

  return (
    <div className="space-y-10">
      <FadeIn className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Your reading room</p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">Hello, {firstName}.</h1>
          <p className="mt-1 text-muted-foreground">
            {(pendingForMe.count ?? 0) > 0
              ? `You have ${pendingForMe.count} swap request${pendingForMe.count === 1 ? "" : "s"} waiting for a reply.`
              : "Here's what's happening on your shelf."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/books/new">
              <BookPlus aria-hidden /> List a book
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/discover">
              <Compass aria-hidden /> Discover
            </Link>
          </Button>
        </div>
      </FadeIn>

      {profile && (profile.geo_lat === null || !profile.location_city) && (
        <Alert variant="info">
          <MapPin aria-hidden />
          <AlertTitle>Add your approximate location</AlertTitle>
          <AlertDescription>
            <p>
              We use it to show distances like “~3 km away” — never your exact location.{" "}
              <Link href="/profile" className="font-medium underline">
                Update your profile
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Your stats
        </h2>
        <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {stats.map((stat) => (
            <StaggerItem key={stat.label}>
              <Link
                href={stat.href}
                className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <stat.icon className="size-5 text-primary" aria-hidden />
                <span className="font-serif text-3xl font-semibold">{stat.value}</span>
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section aria-labelledby="quick-heading" className="grid gap-3 sm:grid-cols-3">
        <h2 id="quick-heading" className="sr-only">
          Quick actions
        </h2>
        {[
          { href: "/wishlist", title: "Tell us what you want", text: "Add titles to your wishlist to unlock mutual matches.", icon: Heart },
          { href: "/matches", title: "Check your matches", text: "See readers who want your books and have one you want.", icon: Sparkles },
          { href: "/swaps", title: "Manage swaps", text: "Reply to requests, chat and confirm exchanges.", icon: ArrowLeftRight },
        ].map((action) => (
          <Link key={action.href} href={action.href} className="group rounded-xl border bg-secondary/40 p-5 transition-colors hover:bg-secondary">
            <action.icon className="size-5 text-forest" aria-hidden />
            <p className="mt-2 font-serif text-lg font-semibold group-hover:underline">{action.title}</p>
            <p className="text-sm text-muted-foreground">{action.text}</p>
          </Link>
        ))}
      </section>

      <section aria-labelledby="recent-heading" className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 id="recent-heading" className="text-2xl font-semibold">
            Recently added near you
          </h2>
          <Button asChild variant="link">
            <Link href="/discover">See all</Link>
          </Button>
        </div>
        {recent.error ? (
          <p className="text-sm text-destructive">Unable to load recent books.</p>
        ) : (recent.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No books from other readers yet.</p>
        ) : (
          <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {(recent.data ?? []).map((book) => (
              <StaggerItem key={book.id}>
                <BookCard book={book} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
    </div>
  );
}
