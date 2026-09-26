import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-serif text-6xl text-primary">404</p>
      <h1 className="text-2xl font-semibold">This chapter doesn&apos;t exist</h1>
      <p className="text-muted-foreground">The page may have been moved, or the book is no longer listed.</p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/discover">Explore books</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </main>
  );
}
