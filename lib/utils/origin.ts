import "server-only";
import { headers } from "next/headers";
import { siteUrl } from "@/lib/env";

/**
 * Origin used for auth redirects. NEXT_PUBLIC_SITE_URL wins when set (so
 * production redirects are stable); otherwise the request's own origin is used,
 * which keeps Vercel preview deployments working.
 */
export async function requestOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return siteUrl();
  const h = await headers();
  const origin = h.get("origin");
  if (origin && /^https?:\/\//.test(origin)) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : siteUrl();
}
