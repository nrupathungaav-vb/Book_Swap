import Link from "next/link";
import { ArrowLeftRight, Bell, CheckCircle2, Handshake, MapPin, MessageCircle, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NOTIFICATION_LABEL, notificationHref } from "@/lib/notifications";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types";

const ICONS: Record<NotificationType, LucideIcon> = {
  swap_request: ArrowLeftRight,
  swap_accepted: Handshake,
  swap_rejected: XCircle,
  swap_cancelled: XCircle,
  swap_completed: CheckCircle2,
  mutual_match: Sparkles,
  new_message: MessageCircle,
  meeting_suggested: MapPin,
  meeting_accepted: MapPin,
  meeting_rejected: MapPin,
  report_update: ShieldCheck,
};

export function NotificationItem({
  notification,
  onOpen,
  compact = false,
}: {
  notification: Notification;
  onOpen?: (notification: Notification) => void;
  compact?: boolean;
}) {
  const Icon = ICONS[notification.type] ?? Bell;
  return (
    <Link
      href={notificationHref(notification)}
      onClick={() => onOpen?.(notification)}
      className={cn(
        "flex gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
        !notification.is_read && "bg-amber/10",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          notification.is_read ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{notification.title}</span>
          {!notification.is_read && <span className="sr-only">(unread)</span>}
          {!notification.is_read && <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />}
        </span>
        <span className={cn("block text-sm text-muted-foreground", compact && "line-clamp-2")}>{notification.message}</span>
        <span className="block text-xs text-muted-foreground/80">
          {NOTIFICATION_LABEL[notification.type]} · {formatRelativeTime(notification.created_at)}
        </span>
      </span>
    </Link>
  );
}
