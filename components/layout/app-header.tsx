import Link from "next/link";
import { Plus } from "lucide-react";
import { AppNav } from "@/components/layout/app-nav";
import { Logo } from "@/components/layout/logo";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types";

export function AppHeader({ profile, unreadCount }: { profile: Profile; unreadCount: number }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo href="/dashboard" />
          <AppNav />
        </div>
        <div className="flex items-center gap-1">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/books/new">
              <Plus aria-hidden /> List a book
            </Link>
          </Button>
          <NotificationBell userId={profile.id} initialUnread={unreadCount} />
          <UserMenu
            name={profile.full_name}
            email={profile.email}
            avatarUrl={profile.avatar_url}
            isAdmin={profile.role === "admin"}
          />
        </div>
      </div>
    </header>
  );
}
