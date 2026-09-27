import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

/**
 * Reached from the reset email via /callback, which exchanges the link for a
 * session first. Signed-in users can also use it to change their password.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?error=${encodeURIComponent("Your reset link has expired. Please request a new one.")}`);
  }
  return (
    <div>
      <h1 className="text-3xl font-semibold">Choose a new password</h1>
      <p className="text-muted-foreground mt-1 mb-6">
        Signed in as <strong>{user.email}</strong>.
      </p>
      <ResetPasswordForm />
    </div>
  );
}
