import { z } from "zod";
import { BOOK_CONDITIONS } from "@/types/database";

export const DISCOVER_PAGE_SIZE = 12;

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const discoverParamsSchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  genre: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  condition: z.preprocess(emptyToUndefined, z.enum(BOOK_CONDITIONS).optional()).catch(undefined),
  status: z.preprocess(emptyToUndefined, z.enum(["Available", "any"]).optional()).catch(undefined),
  distance: z
    .preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(500).optional())
    .catch(undefined),
  sort: z
    .preprocess(emptyToUndefined, z.enum(["newest", "title", "author", "distance", "condition"]).optional())
    .catch(undefined),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(500).optional()).catch(undefined),
});

export type DiscoverParams = z.infer<typeof discoverParamsSchema>;

export function parseDiscoverParams(
  searchParams: Record<string, string | string[] | undefined>,
): DiscoverParams {
  const flat = Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const parsed = discoverParamsSchema.safeParse(flat);
  return parsed.success ? parsed.data : {};
}
