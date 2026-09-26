import { z } from "zod";
import { optionalText, uuidSchema } from "@/lib/validations/common";

export const swapRequestSchema = z
  .object({
    requestedBookId: uuidSchema,
    offeredBookId: uuidSchema,
    note: optionalText(500),
  })
  .refine((v) => v.requestedBookId !== v.offeredBookId, {
    message: "Pick a different book to offer.",
    path: ["offeredBookId"],
  });

export type SwapRequestInput = z.input<typeof swapRequestSchema>;

export const swapActionSchema = z.object({
  swapId: uuidSchema,
  action: z.enum(["accept", "reject", "cancel", "complete"]),
});
