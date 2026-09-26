"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { friendlyDbError, toActionError } from "@/lib/utils/errors";
import { meetingResponseSchema, meetingSchema, type MeetingInput } from "@/lib/validations/meeting";
import type { ActionResult, MeetingLocation } from "@/types";

export async function suggestMeeting(input: MeetingInput): Promise<ActionResult<MeetingLocation>> {
  const parsed = meetingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    const { user, supabase } = await requireUser();
    const { data, error } = await supabase
      .from("meeting_locations")
      .insert({
        swap_request_id: parsed.data.swapId,
        suggested_by_user_id: user.id,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        location_name: parsed.data.locationName,
        suggested_time: parsed.data.suggestedTime,
      })
      .select("*")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: friendlyDbError(error, "Couldn't suggest that spot. Is the swap still accepted?"),
      };
    }
    revalidatePath(`/swaps/${parsed.data.swapId}`);
    return { ok: true, data, message: "Meeting spot suggested." };
  } catch (error) {
    return toActionError(error);
  }
}

export async function respondToMeeting(
  meetingId: string,
  accept: boolean,
): Promise<ActionResult<MeetingLocation>> {
  const parsed = meetingResponseSchema.safeParse({ meetingId, accept });
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("respond_meeting_location", {
      p_meeting_id: parsed.data.meetingId,
      p_accept: parsed.data.accept,
    });
    if (error || !data)
      return { ok: false, error: friendlyDbError(error, "Couldn't respond to that suggestion.") };
    revalidatePath(`/swaps/${data.swap_request_id}`);
    return { ok: true, data, message: accept ? "Meeting spot agreed!" : "Suggestion declined." };
  } catch (error) {
    return toActionError(error);
  }
}
