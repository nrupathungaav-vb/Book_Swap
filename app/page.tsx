import Link from "next/link";
import {
  ArrowRight,
  BookHeart,
  Camera,
  Compass,
  Handshake,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { BookCard } from "@/components/books/book-card";
import { FadeIn } from "@/components/layout/motion";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { DiscoverBook } from "@/types";

async function loadLandingData(): Promise<{ signedIn: boolean; books: DiscoverBook[] }> {
  if (!isSupabaseConfigured()) return { signedIn: false, books: [] };
  try {
    const [user, supabase] = await Promise.all([getCurrentUser(), createClient()]);
    const { data } = await supabase.rpc("discover_books", { p_limit: 4, p_sort: "newest" });
    return { signedIn: Boolean(user), books: data ?? [] };
  } catch {
    return { signedIn: false, books: [] };
  }
}

const SPINES = [
  { h: "h-44", color: "bg-primary", title: "Persuasion" },
  { h: "h-52", color: "bg-forest", title: "The Odyssey" },
  { h: "h-40", color: "bg-amber", title: "Middlemarch" },
  { h: "h-48", color: "bg-foreground/80", title: "Dracula" },
  { h: "h-56", color: "bg-primary/80", title: "Moby-Dick" },
  { h: "h-44", color: "bg-forest/80", title: "Walden" },
];

const STEPS = [
  {
    icon: Camera,
    title: "List your shelf",
    text: "Snap a photo of the actual copy. We fill in the details from Google Books.",
  },
  {
    icon: BookHeart,
    title: "Add a wishlist",
    text: "Tell us what you'd love to read next — as specific or loose as you like.",
  },
  {
    icon: Sparkles,
    title: "Get mutual matches",
    text: "We find readers who want your book and have one you want.",
  },
  {
    icon: Handshake,
    title: "Meet & swap",
    text: "Chat, agree on a public spot on the map, swap, and both confirm.",
  },
];

export default async function LandingPage() {
  const { signedIn, books } = await loadLandingData();

  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <main id="main">
        {/* 1 — Hero */}
        <section className="paper relative overflow-hidden border-b">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.1fr_1fr]">
            <FadeIn className="space-y-6">
              <Badge variant="amber" className="px-3 py-1 text-sm">
                <UsersRound aria-hidden /> Book swapping for your neighbourhood
              </Badge>
              <h1 className="text-4xl leading-[1.05] font-semibold sm:text-5xl lg:text-6xl">
                Your finished books are someone&apos;s{" "}
                <em className="text-primary not-italic">next favourite.</em>
              </h1>
              <p className="text-muted-foreground max-w-xl text-lg">
                BookSwap pairs you with nearby readers who want what you&apos;ve read — and have what you want
                to read. No money, no shipping. Just good books changing hands.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href={signedIn ? "/dashboard" : "/register"}>
                    Start Swapping <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/discover">
                    <Compass aria-hidden /> Explore Books
                  </Link>
                </Button>
              </div>
            </FadeIn>

            <FadeIn delay={0.15} className="relative mx-auto flex h-72 items-end gap-2 sm:h-80" aria-hidden>
              <div className="bg-foreground/15 absolute inset-x-0 bottom-0 h-3 rounded-full" />
              {SPINES.map((spine, index) => (
                <div
                  key={spine.title}
                  className={`spine-shadow relative ${spine.h} w-12 rounded-t-md sm:w-14 ${spine.color} flex items-center justify-center transition-transform duration-300 hover:-translate-y-2`}
                  style={{ transform: index === 3 ? "rotate(-6deg) translateX(-4px)" : undefined }}
                >
                  <span className="rotate-180 font-serif text-xs tracking-wide text-white/90 [writing-mode:vertical-rl]">
                    {spine.title}
                  </span>
                </div>
              ))}
              <div className="bg-card absolute -top-2 -right-4 rotate-6 rounded-xl border p-3 shadow-lg">
                <p className="text-forest flex items-center gap-1.5 text-sm font-semibold">
                  <Sparkles className="size-4" /> Mutual match!
                </p>
                <p className="text-muted-foreground text-xs">Walden ⇄ The Odyssey · 3 km</p>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* 2 — How it works */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="how-heading">
          <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">How BookSwap works</p>
          <h2 id="how-heading" className="mt-2 text-3xl font-semibold">
            Four steps from shelf to swap
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="bg-card relative rounded-xl border p-5 shadow-sm">
                <span className="text-muted-foreground/30 absolute top-4 right-4 font-serif text-3xl">
                  {index + 1}
                </span>
                <step.icon className="text-primary size-6" aria-hidden />
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 3 — Discover books */}
        <section className="bg-secondary/40 border-y" aria-labelledby="discover-heading">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">Discover</p>
                <h2 id="discover-heading" className="mt-2 text-3xl font-semibold">
                  Real copies, photographed by their owners
                </h2>
                <p className="text-muted-foreground mt-2 max-w-2xl">
                  Every listing shows the actual book you&apos;ll get — dog-ears, dust jacket and all — with
                  its condition up front.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/discover">
                  Browse all books <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
            {books.length > 0 ? (
              <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                {books.map((book) => (
                  <BookCard key={book.id} book={book} showActions={false} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground mt-8 rounded-xl border border-dashed p-8 text-center">
                The shelves are filling up — be one of the first to list a book.
              </p>
            )}
          </div>
        </section>

        {/* 4 — Mutual matching */}
        <section
          className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2"
          aria-labelledby="match-heading"
        >
          <div>
            <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">Mutual matching</p>
            <h2 id="match-heading" className="mt-2 text-3xl font-semibold">
              Swaps where both readers win
            </h2>
            <p className="text-muted-foreground mt-3">
              When you own a book someone wants, <strong>and</strong> they own a book on your wishlist,
              BookSwap spots it instantly and lets you both know. Matching runs inside the database, so it
              stays fast as the community grows.
            </p>
          </div>
          <div className="bg-card grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border p-6 shadow-sm">
            <div className="bg-primary/10 rounded-xl p-4 text-center">
              <p className="text-sm font-semibold">You</p>
              <p className="text-muted-foreground mt-2 text-xs">Own</p>
              <p className="font-serif">Dune</p>
              <p className="text-muted-foreground mt-2 text-xs">Want</p>
              <p className="font-serif">Circe</p>
            </div>
            <Handshake className="text-amber size-8" aria-label="swap" />
            <div className="bg-forest/10 rounded-xl p-4 text-center">
              <p className="text-sm font-semibold">A reader nearby</p>
              <p className="text-muted-foreground mt-2 text-xs">Own</p>
              <p className="font-serif">Circe</p>
              <p className="text-muted-foreground mt-2 text-xs">Want</p>
              <p className="font-serif">Dune</p>
            </div>
          </div>
        </section>

        {/* 5 — Safe swapping */}
        <section className="bg-forest text-forest-foreground border-y" aria-labelledby="safe-heading">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1.4fr]">
            <div>
              <ShieldCheck className="size-8" aria-hidden />
              <h2 id="safe-heading" className="mt-3 text-3xl font-semibold">
                Safe by design
              </h2>
              <p className="mt-2 opacity-90">Privacy and safety aren&apos;t add-ons.</p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: MapPin,
                  t: "Approximate distance only",
                  d: "Others see “~3 km away”, never your address or coordinates.",
                },
                {
                  icon: MessageCircle,
                  t: "Private swap chat",
                  d: "Only the two people in a swap can read its messages.",
                },
                {
                  icon: Handshake,
                  t: "Public meeting spots",
                  d: "Agree on a library, café or station on the map — visible only to you two.",
                },
                {
                  icon: ShieldCheck,
                  t: "Report & moderation",
                  d: "Flag a listing or user in two taps; moderators review every report.",
                },
              ].map((item) => (
                <li key={item.t} className="rounded-xl bg-white/10 p-4">
                  <item.icon className="size-5" aria-hidden />
                  <p className="mt-2 font-semibold">{item.t}</p>
                  <p className="text-sm opacity-90">{item.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 6 — AI insights */}
        <section
          className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2"
          aria-labelledby="ai-heading"
        >
          <div className="bg-card order-2 rounded-2xl border p-6 shadow-sm lg:order-1">
            <p className="text-primary flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4" aria-hidden /> Know Before You Swap
              <Badge variant="muted" className="ml-auto">
                Illustration
              </Badge>
            </p>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm">
              <li>A quick, spoiler-free summary in three bullets</li>
              <li>Pacing, mood and reading difficulty</li>
              <li>Who tends to love it — and similar reads</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Is it beginner-friendly?", "What themes does it explore?"].map((q) => (
                <span key={q} className="text-muted-foreground rounded-full border px-3 py-1 text-xs">
                  {q}
                </span>
              ))}
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">AI book insights</p>
            <h2 id="ai-heading" className="mt-2 text-3xl font-semibold">
              Not sure it&apos;s for you? Ask first.
            </h2>
            <p className="text-muted-foreground mt-3">
              Powered by Google Gemini, BookSwap gives you a feel for a book before you commit to a swap — and
              it&apos;s upfront when it isn&apos;t sure, instead of making things up.
            </p>
          </div>
        </section>

        {/* 7 — CTA */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="bg-primary text-primary-foreground mx-auto max-w-4xl rounded-3xl px-6 py-12 text-center shadow-xl sm:px-12">
            <h2 className="text-3xl font-semibold sm:text-4xl">Give a book. Get a book.</h2>
            <p className="mx-auto mt-3 max-w-xl opacity-90">
              It takes about two minutes to list your first book and set up a wishlist.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link href={signedIn ? "/books/new" : "/register"}>Start Swapping</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="text-primary-foreground hover:text-primary-foreground hover:bg-white/15"
              >
                <Link href="/discover">Explore Books</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      {/* 8 — Footer */}
      <SiteFooter />
    </>
  );
}
