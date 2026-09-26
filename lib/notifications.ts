import type { Notification, NotificationType } from "@/types";

/** Where clicking a notification takes the user. */
export function notificationHref(
  n: Pick<Notification, "type" | "related_swap_id" | "related_book_id">,
): string {
  if (n.related_swap_id) return `/swaps/${n.related_swap_id}`;
  if (n.type === "mutual_match") return "/matches";
  if (n.related_book_id) return `/books/${n.related_book_id}`;
  return "/notifications";
}

export const NOTIFICATION_LABEL: Record<NotificationType, string> = {
  swap_request: "Swap request",
  swap_accepted: "Accepted",
  swap_rejected: "Declined",
  swap_cancelled: "Cancelled",
  swap_completed: "Completed",
  mutual_match: "Mutual match",
  new_message: "Message",
  meeting_suggested: "Meeting",
  meeting_accepted: "Meeting",
  meeting_rejected: "Meeting",
  report_update: "Moderation",
};
