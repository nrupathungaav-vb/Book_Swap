import { z } from "zod";
import { BOOK_CONDITIONS } from "@/types/database";
import { httpsUrl, optionalText, uuidSchema } from "@/lib/validations/common";

export const bookSchema = z.object({
  title: z.string().trim().min(1, { message: "Title is required." }).max(300),
  author: z.string().trim().min(1, { message: "Author is required." }).max(200),
  genre: optionalText(100),
  condition: z.enum(BOOK_CONDITIONS, { message: "Choose the book's condition." }),
  description: optionalText(4000),
  googleBooksId: optionalText(64),
  googleCoverUrl: httpsUrl.optional().nullable().or(z.literal("")).transform((v) => v || null),
  isbn: z
    .string()
    .trim()
    .regex(/^[0-9Xx-]{10,17}$/, { message: "ISBN should be 10 or 13 digits." })
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => v || null),
  publish: z.boolean().default(true),
});

export type BookInput = z.input<typeof bookSchema>;
export type BookData = z.output<typeof bookSchema>;

export const bookIdSchema = uuidSchema;

export const bookVisibilitySchema = z.object({
  bookId: uuidSchema,
  hidden: z.boolean(),
});
