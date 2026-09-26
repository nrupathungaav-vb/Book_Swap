import { z } from "zod";
import { uuidSchema } from "@/lib/validations/common";

export const insightsRequestSchema = z.object({
  bookId: uuidSchema,
  refresh: z.boolean().optional().default(false),
});

export const questionRequestSchema = z.object({
  bookId: uuidSchema,
  question: z
    .string()
    .trim()
    .min(3, { message: "Ask a slightly longer question." })
    .max(300, { message: "Keep questions under 300 characters." }),
  history: z
    .array(z.object({ role: z.enum(["user", "model"]), text: z.string().max(4000) }))
    .max(8)
    .optional()
    .default([]),
});

export type QuestionRequest = z.infer<typeof questionRequestSchema>;
