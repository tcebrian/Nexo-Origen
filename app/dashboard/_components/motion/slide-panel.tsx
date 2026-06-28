"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BACKDROP_FADE, PANEL_SLIDE } from "./motion-config";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export function SlidePanel({
  open,
  onClose,
  children,
  className = "",
}: {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return open ? <div className={className}>{children}</div> : null;
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          {onClose ? (
            <motion.button
              type="button"
              aria-label="Cerrar panel"
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
              {...BACKDROP_FADE}
              onClick={onClose}
            />
          ) : null}
          <motion.div className={className} {...PANEL_SLIDE}>
            {children}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function FadePopover({
  open,
  children,
  className = "",
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return open ? <div className={className}>{children}</div> : null;
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={className}
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
