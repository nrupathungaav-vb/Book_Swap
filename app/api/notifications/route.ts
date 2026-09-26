import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { handleRouteError, jsonError } from "@/lib/utils/api";

export const runtime = "nodejs";

/** Latest notifications + unread count for the bell (RLS scopes to the caller). */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Not signed in.", 401);
    const supabase = await createClient();
    const [{ data: items, error }, { count }] = await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false),
    ]);
    if (error) return jsonError("Unable to load notifications.", 500);
    return NextResponse.json(
      { items: items ?? [], unread: count ?? 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleRouteError(error, "Unable to load notifications.");
  }
}
