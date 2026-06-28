"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { PAGE_ENTER } from "./motion-config";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export function PageEnter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <div key={pathname}>{children}</div>;
  }

  return (
    <motion.div
      key={pathname}
      initial={PAGE_ENTER.initial}
      animate={PAGE_ENTER.animate}
      transition={PAGE_ENTER.transition}
    >
      {children}
    </motion.div>
  );
}
