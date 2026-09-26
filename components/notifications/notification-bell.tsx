"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import { NotificationItem } from "@/components/notifications/notification-item";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/hooks/use-notifications";

export function NotificationBell({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const { unread, items, error, loading, refresh, markRead, markAllRead } = useNotifications(
    userId,
    initialUnread,
  );
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu onOpenChange={(open) => open && void refresh()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell aria-hidden />
          {unread > 0 && (
            <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1rem))] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="font-serif font-semibold">Notifications</p>
          <Button
            variant="ghost"
            size="sm"
            disabled={unread === 0 || pending}
            onClick={() =>
              startTransition(async () => {
                const result = await markAllNotificationsRead();
                if (result.ok) markAllRead();
                else toast.error(result.error);
              })
            }
          >
            <CheckCheck aria-hidden /> Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto p-1" aria-live="polite" aria-busy={loading}>
          {loading && !items && (
            <p className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
            </p>
          )}
          {error && <p className="text-destructive p-4 text-sm">{error}</p>}
          {items && items.length === 0 && (
            <p className="text-muted-foreground p-6 text-center text-sm">You&apos;re all caught up.</p>
          )}
          {items?.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              compact
              onOpen={(n) => {
                if (!n.is_read) {
                  markRead(n.id);
                  void markNotificationRead(n.id);
                }
              }}
            />
          ))}
        </div>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/notifications">View all notifications</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
