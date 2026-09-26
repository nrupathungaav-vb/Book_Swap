import { AppHeader } from "@/components/layout/app-header";
import { MobileTabBar } from "@/components/layout/app-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentProfile } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Book detail pages are public; signed-in readers get the app chrome. */
export default async function PublicBooksLayout({ children }: { children: React.ReactNode }) {
  const profile = isSupabaseConfigured() ? await getCurrentProfile() : null;
  let unread = 0;
  if (profile) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false);
    unread = count ?? 0;
  }
  return (
    <div className="flex min-h-dvh flex-col">
      {profile ? <AppHeader profile={profile} unreadCount={unread} /> : <SiteHeader signedIn={false} />}
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:pb-12">
        {children}
      </main>
      {profile ? <MobileTabBar /> : <SiteFooter />}
    </div>
  );
}
