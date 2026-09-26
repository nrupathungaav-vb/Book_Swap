import { z } from "zod";
import { optionalText } from "@/lib/validations/common";

export const profileSchema = z
  .object({
    fullName: z.string().trim().min(2, { message: "Tell us your name." }).max(80),
    bio: optionalText(500),
    locationCity: optionalText(80),
    geoLat: z.number().min(-90).max(90).nullable().optional(),
    geoLng: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine((v) => (v.geoLat == null) === (v.geoLng == null), {
    message: "Pick a point on the map or clear it.",
    path: ["geoLat"],
  });

export type ProfileInput = z.input<typeof profileSchema>;
