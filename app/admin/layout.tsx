import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { MobileTabBar } from "@/components/layout/app-nav";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";

/** Admin area: authentication AND admin role checked on the server (and again in Postgres). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader profile={profile} unreadCount={0} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:pb-12">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
