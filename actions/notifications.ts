"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { friendlyDbError, toActionError } from "@/lib/utils/errors";
import { uuidSchema } from "@/lib/validations/common";
import type { ActionResult } from "@/types";

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid notification." };
  try {
    const { user, supabase } = await requireUser();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", parsed.data)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: friendlyDbError(error) };
    revalidatePath("/notifications");
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireUser();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (error) return { ok: false, error: friendlyDbError(error) };
    revalidatePath("/notifications");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined, message: "All caught up." };
  } catch (error) {
    return toActionError(error);
  }
}
