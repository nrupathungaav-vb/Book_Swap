"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types";

/**
 * Live notification state for the bell: unread count + latest items, kept in
 * sync through Supabase Realtime (RLS guarantees users only receive their own rows).
 */
export function useNotifications(userId: string, initialUnread: number) {
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { items: Notification[]; unread: number };
      setItems(json.items);
      setUnread(json.unread);
    } catch {
      setError("Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const notification = payload.new as Notification;
          setUnread((count) => count + 1);
          setItems((current) => (current ? [notification, ...current].slice(0, 10) : current));
          toast(notification.title, { description: notification.message });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as Notification;
          setItems((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? current);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markRead = useCallback((id: string) => {
    setItems((current) => current?.map((item) => (item.id === id ? { ...item, is_read: true } : item)) ?? current);
    setUnread((count) => Math.max(0, count - 1));
  }, []);

  const markAllRead = useCallback(() => {
    setItems((current) => current?.map((item) => ({ ...item, is_read: true })) ?? current);
    setUnread(0);
  }, []);

  return { unread, items, error, loading, refresh, markRead, markAllRead };
}
