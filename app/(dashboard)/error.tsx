"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { ErrorState } from "@/components/layout/error-state";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-lg space-y-4 py-10">
      <ErrorState message="This page couldn't be loaded. Your data is safe — please try again." />
      <Button onClick={reset}>
        <RotateCcw aria-hidden /> Try again
      </Button>
    </div>
  );
}
