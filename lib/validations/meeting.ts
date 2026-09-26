import { z } from "zod";
import { uuidSchema } from "@/lib/validations/common";

export const meetingSchema = z.object({
  swapId: uuidSchema,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  locationName: z.string().trim().min(2, { message: "Name the place (e.g. \"Central Library entrance\")." }).max(120),
  suggestedTime: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), { message: "Pick a valid date and time." })
    .refine((v) => v === null || Date.parse(v) > Date.now() - 5 * 60 * 1000, {
      message: "Pick a time in the future.",
    }),
});

export type MeetingInput = z.input<typeof meetingSchema>;

export const meetingResponseSchema = z.object({
  meetingId: uuidSchema,
  accept: z.boolean(),
});
