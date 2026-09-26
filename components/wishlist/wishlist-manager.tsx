"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";
import { addWishlistItem, removeWishlistItem } from "@/actions/wishlist";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { formatRelativeTime } from "@/lib/utils";
import { wishlistSchema } from "@/lib/validations/wishlist";
import type { Wishlist } from "@/types";

type FormInput = z.input<typeof wishlistSchema>;
type FormOutput = z.output<typeof wishlistSchema>;

export function WishlistManager({ initialItems }: { initialItems: Wishlist[] }) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState("");
  const [removing, startRemove] = useTransition();
  const reduce = useReducedMotion();
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(wishlistSchema),
    defaultValues: { title: "", author: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await addWishlistItem(values);
    if (!result.ok) {
      if (result.fieldErrors?.title?.[0]) form.setError("title", { message: result.fieldErrors.title[0] });
      toast.error(result.error);
      return;
    }
    setItems((current) => [result.data, ...current]);
    form.reset();
    toast.success(result.message);
  });

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => `${item.title} ${item.author ?? ""}`.toLowerCase().includes(q));
  }, [items, filter]);

  const remove = (id: string) =>
    startRemove(async () => {
      const previous = items;
      setItems((current) => current.filter((item) => item.id !== id));
      const result = await removeWishlistItem(id);
      if (!result.ok) {
        setItems(previous);
        toast.error(result.error);
      }
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Add a book you want</CardTitle>
          <p className="text-sm text-muted-foreground">Leave the author blank to match any edition or author with that title.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField id="wish-title" label="Title" required error={form.formState.errors.title?.message}>
              <Input maxLength={300} placeholder="e.g. The Left Hand of Darkness" {...form.register("title")} />
            </FormField>
            <FormField id="wish-author" label="Author" error={form.formState.errors.author?.message}>
              <Input maxLength={200} placeholder="Optional" {...form.register("author")} />
            </FormField>
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />} Add to wishlist
            </Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="wishlist-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="wishlist-heading" className="text-xl font-semibold">
            Your wishlist <span className="text-base font-normal text-muted-foreground">({items.length})</span>
          </h2>
          {items.length > 3 && (
            <div className="relative w-48">
              <label htmlFor="wishlist-search" className="sr-only">
                Search your wishlist
              </label>
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="wishlist-search" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search…" className="h-9 pl-8" />
            </div>
          )}
        </div>
        {items.length === 0 ? (
          <EmptyState icon={Heart} title="No wishlist items yet." description="Add the books you'd love to read — that's how we find mutual matches." />
        ) : visible.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No wishlist items match “{filter}”.</p>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {visible.map((item) => (
                <motion.li
                  key={item.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: 20 }}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"
                >
                  <Heart className="size-5 shrink-0 fill-primary/20 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif font-semibold">{item.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {item.author || "Any author"} · added {formatRelativeTime(item.created_at)}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => remove(item.id)} disabled={removing} aria-label={`Remove ${item.title} from wishlist`}>
                    <Trash2 aria-hidden />
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}
