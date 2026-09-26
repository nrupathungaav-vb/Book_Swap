"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { friendlyDbError, toActionError } from "@/lib/utils/errors";
import { profileSchema, type ProfileInput } from "@/lib/validations/profile";
import type { ActionResult } from "@/types";

export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const { user, supabase } = await requireUser();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        bio: parsed.data.bio,
        location_city: parsed.data.locationCity,
        geo_lat: parsed.data.geoLat ?? null,
        geo_lng: parsed.data.geoLng ?? null,
      })
      .eq("id", user.id);
    if (error) return { ok: false, error: friendlyDbError(error, "Your profile couldn't be saved.") };
    revalidatePath("/", "layout");
    return { ok: true, data: undefined, message: "Profile saved." };
  } catch (error) {
    return toActionError(error);
  }
}
