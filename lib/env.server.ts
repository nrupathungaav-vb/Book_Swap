import "server-only";
import { z } from "zod";
import { MissingEnvError } from "@/lib/env";

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  GEMINI_API_KEY: z.string().min(10).optional(),
  GEMINI_MODEL: z.string().min(3).default("gemini-2.5-flash"),
  GOOGLE_BOOKS_API_KEY: z.string().min(10).optional(),
});

type ServerEnv = z.infer<typeof serverSchema>;

function read(): ServerEnv {
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
    GEMINI_MODEL: process.env.GEMINI_MODEL || undefined,
    GOOGLE_BOOKS_API_KEY: process.env.GOOGLE_BOOKS_API_KEY || undefined,
  });
  if (!parsed.success) {
    throw new MissingEnvError(parsed.error.issues.map((issue) => String(issue.path[0])));
  }
  return parsed.data;
}

export function serverEnv(): ServerEnv {
  return read();
}

/** Returns the value or throws a MissingEnvError that names (not reveals) the key. */
export function requireServerEnv<K extends keyof ServerEnv>(key: K): NonNullable<ServerEnv[K]> {
  const value = read()[key];
  if (value === undefined || value === null || value === "") {
    throw new MissingEnvError([key]);
  }
  return value as NonNullable<ServerEnv[K]>;
}
