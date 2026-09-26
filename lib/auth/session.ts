import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient, type TypedSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export class AuthError extends Error {
  constructor(message = "You must be signed in to do that.") {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * The verified user for this request (JWT re-validated by Supabase Auth).
 * Memoised per request with React cache().
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
});

/** For pages: redirect to /login when signed out. */
export async function requireUserOrRedirect(next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/** For server actions / route handlers: throw instead of redirecting. */
export async function requireUser(): Promise<{ user: User; supabase: TypedSupabaseClient }> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  const supabase = await createClient();
  return { user, supabase };
}

/** Admin gate checked on the server (and again by is_admin() inside Postgres). */
export async function requireAdmin(): Promise<{
  user: User;
  supabase: TypedSupabaseClient;
  profile: Profile;
}> {
  const { user, supabase } = await requireUser();
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new ForbiddenError("Admin access required.");
  return { user, supabase, profile };
}
