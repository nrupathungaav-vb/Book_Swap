import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { siteUrl } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "BookSwap — swap books with readers near you", template: "%s · BookSwap" },
  description:
    "List the books you've finished, find mutual matches with nearby readers, chat, pick a safe meeting spot and swap. With AI insights before you swap.",
  openGraph: {
    title: "BookSwap",
    description: "Swap physical books with readers near you.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#1f2330" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
