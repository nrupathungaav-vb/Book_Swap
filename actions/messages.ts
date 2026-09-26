"use server";

import { requireUser } from "@/lib/auth/session";
import { friendlyDbError, toActionError } from "@/lib/utils/errors";
import { messageSchema } from "@/lib/validations/message";
import type { ActionResult, Message } from "@/types";

export async function sendMessage(swapId: string, text: string): Promise<ActionResult<Message>> {
  const parsed = messageSchema.safeParse({ swapId, text });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid message." };
  }
  try {
    const { user, supabase } = await requireUser();
    // RLS only allows inserts from a participant of an active swap, as themselves.
    const { data, error } = await supabase
      .from("messages")
      .insert({ swap_request_id: parsed.data.swapId, sender_id: user.id, text: parsed.data.text })
      .select("*")
      .single();
    if (error || !data) {
      return { ok: false, error: friendlyDbError(error, "Message not sent. This chat may be closed.") };
    }
    return { ok: true, data };
  } catch (error) {
    return toActionError(error, "Message not sent.");
  }
}
