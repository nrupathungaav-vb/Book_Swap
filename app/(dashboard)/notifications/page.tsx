import type { Metadata } from "next";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { NotificationsList } from "@/components/notifications/notifications-list";
import { requireUserOrRedirect } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUserOrRedirect("/notifications");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Inbox" title="Notifications" />
      {error ? (
        <ErrorState message="Unable to load notifications." />
      ) : (
        <NotificationsList initial={data ?? []} />
      )}
    </div>
  );
}
