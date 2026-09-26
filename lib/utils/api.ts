import "server-only";
import { NextResponse } from "next/server";
import { MissingEnvError } from "@/lib/env";

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Maps thrown errors to safe JSON responses (never leaks internals or secrets). */
export function handleRouteError(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof MissingEnvError) {
    console.error(error.message);
    return jsonError("This feature isn't configured on the server yet.", 503);
  }
  if (error instanceof Error && error.name === "AuthError") return jsonError(error.message, 401);
  if (error instanceof Error && error.name === "ForbiddenError") return jsonError(error.message, 403);
  console.error(error);
  return jsonError(fallback, 500);
}

/** Same-origin check for state-changing requests (defence in depth vs CSRF). */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser clients; auth cookies are SameSite=Lax anyway
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
