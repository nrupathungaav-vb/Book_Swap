import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { TYPE_TO_EXTENSION, validateImageBytes } from "@/lib/images/validate";
import { handleRouteError, isSameOrigin, jsonError } from "@/lib/utils/api";
import { AVATARS_BUCKET, storagePathFromPublicUrl } from "@/lib/utils/storage";

export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request blocked.", 403);
  try {
    const { user, supabase } = await requireUser();
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return jsonError("Choose an image to upload.", 400);
    if (file.size > MAX_AVATAR_BYTES) return jsonError("Avatars must be 2 MB or smaller.", 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = validateImageBytes({ name: file.name, type: file.type, size: file.size }, bytes);
    if (!check.ok) return jsonError(check.error, 415);

    const path = `${user.id}/${crypto.randomUUID()}.${TYPE_TO_EXTENSION[check.type]}`;
    const { error: uploadError } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, bytes, { contentType: check.type, cacheControl: "31536000", upsert: false });
    if (uploadError) return jsonError("Avatar upload failed.", 502);

    const {
      data: { publicUrl },
    } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
    const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).single();
    const { error } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
    if (error) {
      await supabase.storage.from(AVATARS_BUCKET).remove([path]);
      return jsonError("Avatar upload failed.", 500);
    }
    const previous = storagePathFromPublicUrl(profile?.avatar_url, AVATARS_BUCKET);
    if (previous && previous.startsWith(`${user.id}/`))
      await supabase.storage.from(AVATARS_BUCKET).remove([previous]);

    revalidatePath("/", "layout");
    return NextResponse.json({ url: publicUrl }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Avatar upload failed.");
  }
}
