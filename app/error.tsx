"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const notConfigured = /environment variable/i.test(error.message);

  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-serif text-5xl">📚</p>
      <h1 className="text-2xl font-semibold">A page went missing from the binding</h1>
      <p className="text-muted-foreground">
        {notConfigured
          ? "BookSwap isn't fully configured yet. Check the server environment variables (see .env.example)."
          : "Something unexpected happened. You can try again, or head back home."}
      </p>
      {error.digest && <p className="text-muted-foreground text-xs">Reference: {error.digest}</p>}
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RotateCcw aria-hidden /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}
