"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { NEXO_ORIGEN_ICON_SRC, NexoOrigenWordmark } from "@/app/_components/nexo-brand";
import { AllBrandsMark } from "./all-brands-mark";
import { BrandMark } from "./brand-mark";
import { useAuth } from "./auth-context";
import { DashboardAmbient } from "./dashboard-ambient";
import { DashboardControlsProvider, useDashboardControls } from "./dashboard-controls";
import { buildNavigation, hasActiveItem } from "@/lib/dashboard/navigation";
import { menuItems, restaurantUserMenuItems, settingsMenuItem, isMenuItemActive, type MenuItem } from "./menu";
import { PageEnter } from "./motion/page-enter";
import { usePrefersReducedMotion } from "./motion/use-prefers-reduced-motion";
import { SidebarIcon } from "./sidebar-icons";
import { UserMenu } from "./user-menu";

function SidebarPeriodButton() {
  const { openPanel } = useDashboardControls();

  return (
    <button
      type="button"
      onClick={openPanel}
      className="mb-4 flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-left text-xs text-gray-400 transition hover:border-violet-400/20 hover:bg-white/[0.04] hover:text-gray-200"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-400/15 bg-violet-500/10 text-violet-300">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
        </svg>
      </span>
      <span>
        <span className="block text-[10px] uppercase tracking-[0.08em] text-gray-600">Periodo</span>
        <span className="block text-[12px] text-gray-300">Cambiar fechas de análisis</span>
      </span>
    </button>
  );
}

const desktopLinkClass = (active: boolean) =>
  `group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition duration-200 ${
    active
      ? "bg-gradient-to-r from-purple-600/80 to-violet-700/60 text-white shadow-[0_0_28px_rgba(124,58,237,0.32)]"
      : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
  }`;

/** Enlace de navegación principal del escritorio (con el indicador animado de sección activa). */
function DesktopNavLink({ item, active, reducedMotion }: { item: MenuItem; active: boolean; reducedMotion: boolean }) {
  return (
    <Link href={item.href} className={desktopLinkClass(active)} aria-current={active ? "page" : undefined}>
      {active && !reducedMotion ? (
        <motion.span
          layoutId="dashboard-sidebar-active"
          className="nexo-sidebar-active-indicator"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      ) : active ? (
        <span className="nexo-sidebar-active-indicator" />
      ) : null}
      <motion.span
        className="relative z-[1] flex shrink-0"
        whileHover={reducedMotion ? undefined : { scale: 1.08 }}
        transition={{ duration: 0.2 }}
      >
        <SidebarIcon name={item.icon} className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-gray-500 group-hover:text-gray-300"}`} />
      </motion.span>
      <span className="relative z-[1]">{item.name}</span>
    </Link>
  );
}

/** "Más ▾": desplegable con las secciones secundarias. Se abre solo si la página activa está dentro. */
function MoreMenu({ items, pathname, reducedMotion }: { items: MenuItem[]; pathname: string; reducedMotion: boolean }) {
  const childActive = hasActiveItem(items, pathname, isMenuItemActive);
  const [open, setOpen] = useState(childActive);
  const panelId = useId();

  // Al navegar a una opción de "Más" (p. ej. desde un enlace externo) el grupo se abre solo.
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (items.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`group flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition duration-200 ${
          childActive && !open ? "bg-white/[0.05] text-white" : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
        }`}
      >
        <svg className="h-4 w-4 shrink-0 text-gray-500 group-hover:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
          <circle cx="5.5" cy="12" r="1.2" />
          <circle cx="12" cy="12" r="1.2" />
          <circle cx="18.5" cy="12" r="1.2" />
        </svg>
        <span className="flex-1 text-left">Más</span>
        {childActive && !open ? <span className="h-1.5 w-1.5 rounded-full bg-violet-400" aria-hidden /> : null}
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-gray-500 ${reducedMotion ? "" : "transition-transform duration-200"} ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div
        id={panelId}
        className={`grid ${reducedMotion ? "" : "transition-[grid-template-rows] duration-200 ease-out"} ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden" inert={!open}>
          <ul className="mt-1 space-y-0.5 border-l border-white/[0.08] pl-2 ml-5">
            {items.map((item) => {
              const active = isMenuItemActive(pathname, item.href);
              return (
                <li key={item.section}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition ${
                      active
                        ? "bg-gradient-to-r from-purple-600/70 to-violet-700/50 text-white"
                        : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <SidebarIcon name={item.icon} className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-gray-500"}`} />
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    empresaNombre,
    showGrupoHambarClientBadge,
    canAccessSection,
    isRestaurantUser,
    primaryRestaurant,
    scope,
  } = useAuth();
  // Mismos filtros de siempre: permisos por rol y "un solo restaurante → sin lista de Restaurantes".
  // Ajustes entra al mismo filtro (`canAccessSection("ajustes")`) y solo cambia de sitio: ahora va en "Más".
  const allowedItems = [...(isRestaurantUser ? restaurantUserMenuItems : menuItems), settingsMenuItem]
    .filter((item) => canAccessSection(item.section))
    .filter((item) => !(primaryRestaurant && item.section === "restaurantes"));
  const desktopNav = buildNavigation(allowedItems, "desktop");
  const mobileNav = buildNavigation(allowedItems, "mobile");
  const restaurantHref = primaryRestaurant
    ? `/dashboard/restaurantes/${primaryRestaurant.slug}`
    : null;
  const singleBrand = scope.brandIds?.length === 1 ? scope.brandIds[0] : null;
  const showEmpresaBadge = showGrupoHambarClientBadge || Boolean(singleBrand);
  const reducedMotion = usePrefersReducedMotion();
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const mobileMoreActive = hasActiveItem(mobileNav.more, pathname, isMenuItemActive);

  useEffect(() => {
    setMoreSheetOpen(false);
  }, [pathname]);

  const empresaBadge = showEmpresaBadge ? (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
      {singleBrand ? <BrandMark brand={singleBrand} size="xs" /> : <AllBrandsMark size="xs" alt={empresaNombre} />}
      <div className="min-w-0">
        <p className="truncate text-[12px] font-medium text-gray-200">{empresaNombre}</p>
        <p className="truncate text-[10px] text-gray-500">Cliente activo</p>
      </div>
    </div>
  ) : null;

  const restaurantCard =
    isRestaurantUser && primaryRestaurant && restaurantHref ? (
      <Link
        href={restaurantHref}
        className="block rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition hover:border-violet-400/20 hover:bg-white/[0.05]"
      >
        <div className="flex items-center gap-3">
          <BrandMark brand={primaryRestaurant.brand} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-gray-100">{primaryRestaurant.name}</p>
            <p className="truncate text-[11px] text-gray-500">{primaryRestaurant.location}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] font-medium text-violet-300">Ver restaurante →</p>
      </Link>
    ) : null;

  return (
    <DashboardControlsProvider>
      <main className="relative h-screen overflow-hidden bg-[#05030A] font-sans text-white antialiased">
        <DashboardAmbient />

        <div className="relative z-[1] flex h-[49px] items-center justify-between border-b border-white/[0.08] bg-black/35 px-4 backdrop-blur-2xl lg:hidden">
          <Image src={NEXO_ORIGEN_ICON_SRC} alt="Nexo Origen" width={28} height={28} className="shrink-0" />
          {showEmpresaBadge ? (
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5">
              {singleBrand ? (
                <BrandMark brand={singleBrand} size="chip" />
              ) : (
                <AllBrandsMark size="chip" alt={empresaNombre} />
              )}
              <span className="truncate text-[11px] font-medium text-gray-300">{empresaNombre}</span>
            </div>
          ) : null}
        </div>

        {moreSheetOpen ? (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMoreSheetOpen(false)}
          />
        ) : null}

        {/* Hoja "Más" (móvil): lo secundario hace scroll; el usuario queda fijo al pie, sin tapar opciones. */}
        <div
          style={{ transform: moreSheetOpen ? "translateY(0)" : "translateY(100%)" }}
          aria-hidden={!moreSheetOpen}
          inert={!moreSheetOpen}
          className="fixed inset-x-0 bottom-0 z-40 flex max-h-[80vh] flex-col rounded-t-3xl border-t border-white/[0.08] bg-[#0a0812]/98 backdrop-blur-2xl transition-transform duration-200 lg:hidden"
        >
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/15" />

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
            {mobileNav.more.length > 0 ? (
              <nav className="space-y-1">
                {mobileNav.more.map((item) => {
                  const active = isMenuItemActive(pathname, item.href);
                  return (
                    <Link
                      key={item.section}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition ${
                        active
                          ? "bg-gradient-to-r from-purple-600/80 to-violet-700/60 text-white"
                          : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      <SidebarIcon name={item.icon} className="h-4 w-4 shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            ) : null}

            {empresaBadge}
            <SidebarPeriodButton />
            {restaurantCard}
          </div>

          <div className="shrink-0 border-t border-white/[0.08] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <UserMenu />
          </div>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-white/[0.08] bg-black/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl lg:hidden">
          {mobileNav.main.map((item) => {
            const active = isMenuItemActive(pathname, item.href) && !moreSheetOpen;
            return (
              <Link
                key={item.section}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition ${
                  active ? "text-violet-300" : "text-gray-500"
                }`}
              >
                <SidebarIcon name={item.icon} className="h-5 w-5" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreSheetOpen((v) => !v)}
            aria-expanded={moreSheetOpen}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition ${
              moreSheetOpen || mobileMoreActive ? "text-violet-300" : "text-gray-500"
            }`}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="12" cy="5" r="1.4" />
              <circle cx="12" cy="12" r="1.4" />
              <circle cx="12" cy="19" r="1.4" />
            </svg>
            <span>Más</span>
          </button>
        </nav>

        <div className="relative z-[1] flex h-[calc(100vh-49px)] lg:h-screen">
          <aside className="hidden h-full min-h-0 w-[250px] shrink-0 flex-col border-r border-white/[0.08] bg-black/35 backdrop-blur-2xl lg:flex">
            <div className="shrink-0 px-6 pb-4 pt-7">
              <NexoOrigenWordmark size="sm" align="center" variant="dashboard" className="mx-auto" />
              {empresaBadge ? <div className="mt-4">{empresaBadge}</div> : null}
            </div>

            {/* Zona con scroll: la navegación y las tarjetas. El bloque de usuario NO se mueve. */}
            <div className="nexo-sidebar-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">
              <nav className="space-y-1" aria-label="Navegación principal">
                <SidebarPeriodButton />
                {desktopNav.main.map((item) => (
                  <DesktopNavLink key={item.section} item={item} active={isMenuItemActive(pathname, item.href)} reducedMotion={reducedMotion} />
                ))}
                <MoreMenu items={desktopNav.more} pathname={pathname} reducedMotion={reducedMotion} />
              </nav>

              {restaurantCard}

              {!isRestaurantUser ? (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 shadow-2xl backdrop-blur-xl">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xl text-purple-300">✧</span>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">NEXO IA</p>
                      <span className="rounded-full border border-purple-400/30 bg-purple-500/15 px-2 py-0.5 text-[9px] text-purple-200">
                        Próximamente
                      </span>
                    </div>
                  </div>
                  <p className="mb-4 text-xs leading-relaxed text-gray-400">
                    Pregúntale a nuestra IA sobre tu reputación. Disponible muy pronto.
                  </p>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    aria-label="NEXO IA — disponible próximamente"
                    className="block w-full cursor-not-allowed rounded-xl border border-purple-400/20 bg-purple-500/10 py-2.5 text-center text-xs text-purple-200/70 opacity-80"
                  >
                    Próximamente
                  </button>
                </div>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-white/[0.08] p-3">
              <UserMenu />
            </div>
          </aside>

          <section className={`nexo-radial-depth min-w-0 flex-1 overflow-y-auto px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:py-6 lg:pb-6 ${isRestaurantUser ? "bg-[#05030A]" : ""}`}>
            <div className={`mx-auto ${isRestaurantUser ? "max-w-[1480px]" : "max-w-[1680px]"}`}>
              <PageEnter>{children}</PageEnter>
            </div>
          </section>
        </div>
      </main>
    </DashboardControlsProvider>
  );
}
