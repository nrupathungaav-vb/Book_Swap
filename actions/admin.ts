"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { friendlyDbError, toActionError } from "@/lib/utils/errors";
import { uuidSchema } from "@/lib/validations/common";
import { reportUpdateSchema } from "@/lib/validations/report";
import type { ActionResult, ReportStatus } from "@/types";

export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  notes?: string | null,
): Promise<ActionResult> {
  const parsed = reportUpdateSchema.safeParse({ reportId, status, notes });
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.rpc("admin_update_report", {
      p_report_id: parsed.data.reportId,
      p_status: parsed.data.status,
      p_notes: parsed.data.notes,
    });
    if (error) return { ok: false, error: friendlyDbError(error) };
    revalidatePath("/admin");
    return { ok: true, data: undefined, message: `Report marked ${parsed.data.status.toLowerCase()}.` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function adminSetBookVisibility(bookId: string, hidden: boolean): Promise<ActionResult> {
  const parsed = uuidSchema.safeParse(bookId);
  if (!parsed.success) return { ok: false, error: "Invalid book." };
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.rpc("admin_set_book_visibility", { p_book_id: parsed.data, p_hidden: hidden });
    if (error) return { ok: false, error: friendlyDbError(error) };
    revalidatePath("/admin");
    revalidatePath("/discover");
    revalidatePath(`/books/${parsed.data}`);
    return { ok: true, data: undefined, message: hidden ? "Book hidden from BookSwap." : "Book restored." };
  } catch (error) {
    return toActionError(error);
  }
}
