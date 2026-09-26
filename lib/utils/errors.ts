import { MissingEnvError } from "@/lib/env";
import type { ActionResult } from "@/types";

type PgLikeError = { code?: string; message?: string; details?: string | null; hint?: string | null };

/**
 * Turns Supabase/Postgres errors into messages that are safe to show users.
 * Workflow functions raise human-readable messages (errcodes 22023/42501/P0002/23505
 * with our own text); anything else is logged and replaced with a generic message.
 */
export function friendlyDbError(error: PgLikeError | null | undefined, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  const code = error.code ?? "";
  const message = error.message ?? "";

  if (code === "42501" && /row-level security|permission denied/i.test(message)) {
    return "You don't have permission to do that.";
  }
  if (code === "23505") {
    if (/wishlists_unique_item/.test(message)) return "That book is already on your wishlist.";
    if (/reports_one_open_per_target/.test(message)) return "You've already reported this — our moderators are on it.";
    return /already/i.test(message) ? message : "That already exists.";
  }
  if (code === "23514") {
    return /Invalid .* transition/.test(message) ? message : "Some of the values aren't allowed.";
  }
  // Messages we raise ourselves from PL/pgSQL are written for end users.
  if (["22023", "42501", "P0002"].includes(code) && message) {
    return message;
  }
  if (code === "PGRST116") return "Not found.";
  console.error("[db]", code, message, error.details ?? "");
  return fallback;
}

export function toActionError(error: unknown, fallback?: string): ActionResult<never> {
  if (error instanceof MissingEnvError) {
    console.error(error.message);
    return { ok: false, error: "This feature isn't configured yet. Please contact the site owner." };
  }
  if (error instanceof Error && (error.name === "AuthError" || error.name === "ForbiddenError")) {
    return { ok: false, error: error.message };
  }
  console.error(error);
  return { ok: false, error: fallback ?? "Something went wrong. Please try again." };
}
