import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { MobileTabBar } from "@/components/layout/app-nav";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Server-side auth check (middleware is only a convenience redirect).
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getCurrentProfile();
  // Don't redirect to /login here: middleware would bounce a signed-in user straight back (loop).
  if (!profile) throw new Error("Your profile could not be loaded. Please try again in a moment.");

  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader profile={profile} unreadCount={count ?? 0} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:pb-12">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
