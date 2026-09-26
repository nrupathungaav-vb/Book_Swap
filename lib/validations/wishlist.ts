import { z } from "zod";
import { optionalText } from "@/lib/validations/common";

export const wishlistSchema = z.object({
  title: z.string().trim().min(1, { message: "Which book are you after?" }).max(300),
  author: optionalText(200),
});

export type WishlistInput = z.input<typeof wishlistSchema>;
