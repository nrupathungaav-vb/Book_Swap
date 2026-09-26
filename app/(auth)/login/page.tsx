import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AuthDivider } from "@/components/auth/divider";
import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { safeNextPath } from "@/lib/utils/redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNextPath(rawNext);
  return (
    <div>
      <h1 className="text-3xl font-semibold">Welcome back</h1>
      <p className="mt-1 mb-6 text-muted-foreground">Sign in to see your matches and swaps.</p>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle aria-hidden />
          <AlertDescription>{error.slice(0, 200)}</AlertDescription>
        </Alert>
      )}
      <GoogleButton next={next} />
      <AuthDivider />
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to BookSwap?{" "}
        <Link href={`/register${rawNext ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
