"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/utils/origin";
import { safeNextPath } from "@/lib/utils/redirect";
import { toActionError } from "@/lib/utils/errors";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import type { ActionResult } from "@/types";

export async function signInWithPassword(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      if (/email not confirmed/i.test(error.message)) {
        return { ok: false, error: "Please confirm your email address first — check your inbox." };
      }
      return { ok: false, error: "Incorrect email or password." };
    }
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function signUpWithPassword(
  input: RegisterInput,
): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const supabase = await createClient();
    const origin = await requestOrigin();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
        emailRedirectTo: `${origin}/callback?next=/profile`,
      },
    });
    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        return { ok: false, error: "An account with this email already exists. Try signing in." };
      }
      if (/password/i.test(error.message)) return { ok: false, error: error.message };
      return { ok: false, error: "We couldn't create your account. Please try again." };
    }
    return { ok: true, data: { needsConfirmation: !data.session } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNextPath(formData.get("next")?.toString());
  const supabase = await createClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent("Google sign-in is unavailable right now.")}`);
  }
  redirect(data.url);
}

/**
 * Emails a password-reset link. Always reports success so the form can't be
 * used to discover which emails have accounts.
 */
export async function requestPasswordReset(input: ForgotPasswordInput): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const supabase = await createClient();
    const origin = await requestOrigin();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/callback?next=/reset-password`,
    });
    if (error) {
      if (error.status === 429 || /rate limit|too many/i.test(error.message)) {
        return { ok: false, error: "Too many reset emails were requested. Please wait a few minutes." };
      }
      console.error("[auth] resetPasswordForEmail failed:", error.message);
    }
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

/** Sets a new password for the signed-in user (the reset link signs them in first). */
export async function updatePassword(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Your reset link has expired. Please request a new one." };
    }
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      if (/different from the old|same password/i.test(error.message)) {
        return { ok: false, error: "Choose a password different from your current one." };
      }
      if (/password/i.test(error.message)) return { ok: false, error: error.message };
      return { ok: false, error: "We couldn't update your password. Please try again." };
    }
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
