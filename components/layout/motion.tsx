"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

/** Gentle fade/slide-in that respects prefers-reduced-motion. */
export function FadeIn({
  delay = 0,
  y = 12,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    />
  );
}

/** Staggers direct children that are <StaggerItem>. */
export function Stagger({ stagger = 0.05, ...props }: HTMLMotionProps<"div"> & { stagger?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : stagger } } }}
      {...props}
    />
  );
}

export function StaggerItem(props: HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
      }}
      {...props}
    />
  );
}
