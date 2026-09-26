import { z } from "zod";
import { uuidSchema } from "@/lib/validations/common";

export const messageSchema = z.object({
  swapId: uuidSchema,
  text: z
    .string()
    .trim()
    .min(1, { message: "Write a message first." })
    .max(2000, { message: "Messages are limited to 2000 characters." }),
});

export type MessageInput = z.input<typeof messageSchema>;
