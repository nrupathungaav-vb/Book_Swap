import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <main id="main" className="flex flex-col px-4 py-8 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
      <aside
        className="paper bg-secondary/60 relative hidden overflow-hidden border-l lg:flex lg:flex-col lg:justify-end lg:p-12"
        aria-hidden
      >
        <div className="from-primary/15 to-amber/10 absolute inset-0 bg-gradient-to-t via-transparent" />
        <blockquote className="relative max-w-md space-y-3">
          <p className="font-serif text-3xl leading-snug">
            “A book on your shelf is a story paused. A book in someone&apos;s hands is a story continued.”
          </p>
          <footer className="text-muted-foreground text-sm">— The BookSwap community</footer>
        </blockquote>
      </aside>
    </div>
  );
}
