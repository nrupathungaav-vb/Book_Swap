"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { toggleWishlistForBook } from "@/actions/wishlist";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WishlistButton({
  bookId,
  initialInWishlist,
  withLabel = false,
}: {
  bookId: string;
  initialInWishlist: boolean;
  withLabel?: boolean;
}) {
  const [inWishlist, setInWishlist] = useState(initialInWishlist);
  const [pending, startTransition] = useTransition();
  const reduce = useReducedMotion();

  const onClick = () =>
    startTransition(async () => {
      const previous = inWishlist;
      setInWishlist(!previous); // optimistic
      const result = await toggleWishlistForBook(bookId);
      if (!result.ok) {
        setInWishlist(previous);
        toast.error(result.error);
        return;
      }
      setInWishlist(result.data.inWishlist);
      toast.success(result.message);
    });

  return (
    <Button
      type="button"
      variant="outline"
      size={withLabel ? "default" : "icon-sm"}
      onClick={onClick}
      disabled={pending}
      aria-pressed={inWishlist}
      aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
      title={inWishlist ? "On your wishlist" : "Add to wishlist"}
    >
      <motion.span
        key={String(inWishlist)}
        initial={reduce ? false : { scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 18 }}
        className="flex"
      >
        <Heart className={cn(inWishlist && "fill-primary text-primary")} aria-hidden />
      </motion.span>
      {withLabel && (inWishlist ? "On wishlist" : "Add to wishlist")}
    </Button>
  );
}
