"use client";

import { motion } from "framer-motion";
import { STAGGER_CHILD_DELAY, STAGGER_ROW } from "./motion-config";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export function StaggerList({
  children,
  className,
  delay = STAGGER_CHILD_DELAY,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={STAGGER_ROW}
      transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
