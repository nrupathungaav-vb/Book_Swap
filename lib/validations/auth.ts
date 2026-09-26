import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Enter a valid email address." }));

export const passwordSchema = z
  .string()
  .min(8, { message: "Use at least 8 characters." })
  .max(72, { message: "Use at most 72 characters." })
  .regex(/[A-Za-z]/, { message: "Include at least one letter." })
  .regex(/[0-9]/, { message: "Include at least one number." });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Enter your password." }).max(72),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, { message: "Tell us your name." }).max(80),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
