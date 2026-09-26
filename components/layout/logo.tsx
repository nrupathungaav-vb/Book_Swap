import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect x="3" y="6" width="11" height="20" rx="2" className="fill-primary" />
      <rect x="18" y="6" width="11" height="20" rx="2" className="fill-forest" />
      <path
        d="M11 12h10m0 0-3-3m3 3-3 3M21 20H11m0 0 3 3m-3-3 3-3"
        className="stroke-amber"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md font-serif text-xl font-semibold tracking-tight",
        className,
      )}
    >
      <LogoMark />
      <span>
        Book<span className="text-primary">Swap</span>
      </span>
    </Link>
  );
}
