import { z } from "zod";
import { REPORT_REASONS, REPORT_STATUSES } from "@/types/database";
import { optionalText, uuidSchema } from "@/lib/validations/common";

export const reportSchema = z
  .object({
    reportedBookId: uuidSchema.optional().nullable(),
    reportedUserId: uuidSchema.optional().nullable(),
    reason: z.enum(REPORT_REASONS, { message: "Choose a reason." }),
    description: optionalText(1000),
  })
  .refine((v) => Boolean(v.reportedBookId || v.reportedUserId), {
    message: "Nothing to report.",
    path: ["reason"],
  });

export type ReportInput = z.input<typeof reportSchema>;

export const reportUpdateSchema = z.object({
  reportId: uuidSchema,
  status: z.enum(REPORT_STATUSES),
  notes: optionalText(1000),
});
