"use client";

import { useState, useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import { EmptyState } from "@/components/layout/empty-state";
import { NotificationItem } from "@/components/notifications/notification-item";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/types";

export function NotificationsList({ initial }: { initial: Notification[] }) {
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const unread = items.filter((n) => !n.is_read).length;

  if (items.length === 0) {
    return <EmptyState icon={Bell} title="No notifications yet" description="Swap requests, matches and messages will show up here." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{unread} unread</p>
        <Button
          variant="outline"
          size="sm"
          disabled={unread === 0 || pending}
          onClick={() =>
            startTransition(async () => {
              const result = await markAllNotificationsRead();
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setItems((current) => current.map((n) => ({ ...n, is_read: true })));
            })
          }
        >
          <CheckCheck aria-hidden /> Mark all as read
        </Button>
      </div>
      <ul className="divide-y rounded-2xl border bg-card p-1 shadow-sm">
        {items.map((notification) => (
          <li key={notification.id} className="py-0.5">
            <NotificationItem
              notification={notification}
              onOpen={(n) => {
                if (n.is_read) return;
                setItems((current) => current.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)));
                void markNotificationRead(n.id);
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
