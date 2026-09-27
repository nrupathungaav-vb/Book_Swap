import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/** Routes that require a signed-in user. */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/discover",
  "/books",
  "/wishlist",
  "/matches",
  "/swaps",
  "/profile",
  "/notifications",
  "/admin",
];

/** Public exceptions under a protected prefix (book details are shareable). */
const PUBLIC_PATTERNS = [/^\/books\/[0-9a-f-]{36}\/?$/i];

export function isProtectedPath(pathname: string): boolean {
  if (PUBLIC_PATTERNS.some((pattern) => pattern.test(pathname))) return false;
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * unauthenticated users away from protected routes. This is a UX guard only:
 * every page, action and route handler re-checks the user on the server, and
 * RLS enforces access in the database.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return response;
  }

  const env = publicEnv();
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the JWT with Supabase Auth (unlike getSession()).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
