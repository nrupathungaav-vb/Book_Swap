import { z } from "zod";

export const uuidSchema = z.uuid({ message: "Invalid id." });

/** Optional free text: trims, turns "" into null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `Keep it under ${max} characters.` })
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

export const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("https://"), { message: "Must be an https URL." });
