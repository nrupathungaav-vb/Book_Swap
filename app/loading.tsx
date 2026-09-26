import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="text-primary size-6 animate-spin" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
