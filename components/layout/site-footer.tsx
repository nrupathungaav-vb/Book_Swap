import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export function SiteFooter() {
  return (
    <footer className="border-t bg-secondary/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            A friendlier way to give your finished books a second life — and find your next read nearby.
          </p>
        </div>
        <nav aria-label="Explore" className="space-y-2 text-sm">
          <p className="font-semibold">Explore</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><Link className="hover:text-foreground" href="/discover">Discover books</Link></li>
            <li><Link className="hover:text-foreground" href="/register">Create an account</Link></li>
            <li><Link className="hover:text-foreground" href="/login">Sign in</Link></li>
          </ul>
        </nav>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Swap safely</p>
          <p className="text-muted-foreground">
            Always meet in busy public places like libraries, cafés or station concourses, and tell a friend where you&apos;re going.
          </p>
        </div>
      </div>
      <p className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BookSwap. Made for readers.
      </p>
    </footer>
  );
}
