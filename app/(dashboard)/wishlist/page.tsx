import type { Metadata } from "next";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { WishlistManager } from "@/components/wishlist/wishlist-manager";
import { requireUserOrRedirect } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const user = await requireUserOrRedirect("/wishlist");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wishlists")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        eyebrow="Wishlist"
        title="Books you're hunting for"
        description="Your wishlist is private. It powers mutual matching behind the scenes."
      />
      {error ? (
        <ErrorState message="Your wishlist couldn't be loaded." />
      ) : (
        <WishlistManager initialItems={data ?? []} />
      )}
    </div>
  );
}
