"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { PAGE_ENTER } from "./motion-config";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/**
 * Clave de sección (p. ej. "/dashboard/resenas"), no la ruta completa. Con la
 * ruta completa como key, entrar en /dashboard/resenas/[id] y volver remonta
 * TODO lo de dentro de PageEnter en cada paso — incluida cualquier memoria de
 * sección (filtros, scroll) guardada en un layout.tsx de esa sección, aunque
 * Next.js no lo hubiera desmontado por sí solo. Con la key por sección, solo
 * se remonta (y se reanima) al cambiar de verdad de sección.
 */
function getSectionKey(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return `/${segments.slice(0, 2).join("/")}`;
}

export function PageEnter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sectionKey = getSectionKey(pathname);
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <div key={sectionKey}>{children}</div>;
  }

  return (
    <motion.div
      key={sectionKey}
      initial={PAGE_ENTER.initial}
      animate={PAGE_ENTER.animate}
      transition={PAGE_ENTER.transition}
    >
      {children}
    </motion.div>
  );
}
