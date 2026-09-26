import { z } from "zod";

/**
 * Environment access layer.
 *
 * - Public values are read through `publicEnv()` and are safe in the browser.
 *   Next.js inlines `process.env.NEXT_PUBLIC_*` at build time, so each key is
 *   referenced literally below.
 * - Server-only values are read through `serverEnv()` in `lib/env.server.ts`,
 *   which imports "server-only" so it can never be bundled for the browser.
 *
 * Missing variables raise a `MissingEnvError` naming the variable (never its
 * value) only when a feature that needs it is used, so e.g. a missing Gemini
 * key doesn't take down the rest of the app.
 */

export class MissingEnvError extends Error {
  constructor(public readonly variables: string[]) {
    super(
      `Missing or invalid environment variable(s): ${variables.join(", ")}. ` +
        "Add them to .env.local (see .env.example) or your Vercel project settings.",
    );
    this.name = "MissingEnvError";
  }
}

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cachedPublic: PublicEnv | null = null;

export function publicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
  if (!parsed.success) {
    throw new MissingEnvError(parsed.error.issues.map((issue) => String(issue.path[0])));
  }
  cachedPublic = parsed.data;
  return cachedPublic;
}

export function isSupabaseConfigured(): boolean {
  try {
    publicEnv();
    return true;
  } catch {
    return false;
  }
}

/** Absolute site URL for redirects; falls back to Vercel's URL, then localhost. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
