import type { Metadata } from "next";
import Link from "next/link";
import { AuthDivider } from "@/components/auth/divider";
import { GoogleButton } from "@/components/auth/google-button";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create your account" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold">Join BookSwap</h1>
      <p className="mt-1 mb-6 text-muted-foreground">List a book, build a wishlist, and start swapping.</p>
      <GoogleButton next="/profile?welcome=1" label="Sign up with Google" />
      <AuthDivider />
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
