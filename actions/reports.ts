"use server";

import { requireUser } from "@/lib/auth/session";
import { friendlyDbError, toActionError } from "@/lib/utils/errors";
import { reportSchema, type ReportInput } from "@/lib/validations/report";
import type { ActionResult } from "@/types";

export async function createReport(input: ReportInput): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const { user, supabase } = await requireUser();
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_book_id: parsed.data.reportedBookId ?? null,
      reported_user_id: parsed.data.reportedUserId ?? null,
      reason: parsed.data.reason,
      description: parsed.data.description,
    });
    if (error) return { ok: false, error: friendlyDbError(error, "Your report couldn't be sent.") };
    return { ok: true, data: undefined, message: "Thanks — a moderator will review this." };
  } catch (error) {
    return toActionError(error);
  }
}
