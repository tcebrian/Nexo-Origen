"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NEXO_ORIGEN_ICON_SRC, NexoOrigenWordmark } from "@/app/_components/nexo-brand";
import { AllBrandsMark } from "./all-brands-mark";
import { BrandMark } from "./brand-mark";
import { useAuth } from "./auth-context";
import { DashboardAmbient } from "./dashboard-ambient";
import { DashboardControlsProvider, useDashboardControls } from "./dashboard-controls";
import { menuItems, restaurantUserMenuItems, settingsHref, settingsSection, isMenuItemActive } from "./menu";
import { PageEnter } from "./motion/page-enter";
import { usePrefersReducedMotion } from "./motion/use-prefers-reduced-motion";
import { SidebarIcon } from "./sidebar-icons";
import { LogoutButton } from "./logout-button";

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

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    displayName,
    roleLabel,
    initials,
    empresaNombre,
    showGrupoHambarClientBadge,
    canAccessSection,
    isRestaurantUser,
    primaryRestaurant,
    scope,
  } = useAuth();
  const settingsActive = isMenuItemActive(pathname, settingsHref);
  const navItems = (isRestaurantUser ? restaurantUserMenuItems : menuItems)
    .filter((item) => canAccessSection(item.section))
    // Un solo restaurante: la lista "Restaurantes" es redundante con Inicio.
    .filter((item) => !(primaryRestaurant && item.section === "restaurantes"));
  const showSettings = canAccessSection(settingsSection);
  const restaurantHref = primaryRestaurant
    ? `/dashboard/restaurantes/${primaryRestaurant.slug}`
    : null;
  const singleBrand = scope.brandIds?.length === 1 ? scope.brandIds[0] : null;
  const showEmpresaBadge = showGrupoHambarClientBadge || Boolean(singleBrand);
  const reducedMotion = usePrefersReducedMotion();
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const primaryNavItems = navItems.slice(0, 4);
  const overflowNavItems = navItems.slice(4);

  useEffect(() => {
    setMoreSheetOpen(false);
  }, [pathname]);

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

        <div
          style={{ transform: moreSheetOpen ? "translateY(0)" : "translateY(100%)" }}
          className="fixed inset-x-0 bottom-0 z-40 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-white/[0.08] bg-[#0a0812]/98 backdrop-blur-2xl transition-transform duration-200 lg:hidden"
        >
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15" />

          {overflowNavItems.length > 0 ? (
            <nav className="space-y-1 px-4 pt-4">
              {overflowNavItems.map((item) => {
                const active = isMenuItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
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

          <div className="space-y-4 p-4">
            {showEmpresaBadge ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                {singleBrand ? (
                  <BrandMark brand={singleBrand} size="xs" />
                ) : (
                  <AllBrandsMark size="xs" alt={empresaNombre} />
                )}
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-gray-200">{empresaNombre}</p>
                  <p className="truncate text-[10px] text-gray-500">Cliente activo</p>
                </div>
              </div>
            ) : null}

            <SidebarPeriodButton />

            {isRestaurantUser && primaryRestaurant && restaurantHref ? (
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
            ) : null}

            <div className="flex items-center gap-3 border-t border-white/[0.08] pt-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-300/40 bg-purple-500/10 text-xs font-semibold text-purple-100">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{displayName}</p>
                <p className="truncate text-xs text-gray-500">{roleLabel}</p>
              </div>
            </div>

            {showSettings ? (
              <Link
                href={settingsHref}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition ${
                  settingsActive
                    ? "bg-white/[0.06] text-white"
                    : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <SidebarIcon name="settings" className="h-4 w-4" />
                <span>Configuración</span>
              </Link>
            ) : null}

            <LogoutButton />
          </div>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-white/[0.08] bg-black/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl lg:hidden">
          {primaryNavItems.map((item) => {
            const active = isMenuItemActive(pathname, item.href) && !moreSheetOpen;
            return (
              <Link
                key={item.name}
                href={item.href}
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
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition ${
              moreSheetOpen ? "text-violet-300" : "text-gray-500"
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
          <aside className="hidden w-[250px] shrink-0 flex-col border-r border-white/[0.08] bg-black/35 backdrop-blur-2xl lg:flex">
            <div className="px-6 pb-6 pt-7">
              <NexoOrigenWordmark size="sm" align="center" variant="dashboard" className="mx-auto" />

              {showEmpresaBadge ? (
                <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                  {singleBrand ? (
                    <BrandMark brand={singleBrand} size="xs" />
                  ) : (
                    <AllBrandsMark size="xs" alt={empresaNombre} />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-gray-200">{empresaNombre}</p>
                    <p className="truncate text-[10px] text-gray-500">Cliente activo</p>
                  </div>
                </div>
              ) : null}
            </div>

            <nav className="flex-1 space-y-1 px-4">
              <SidebarPeriodButton />
              {navItems.map((item) => {
                const active = isMenuItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition duration-200 ${
                      active
                        ? "bg-gradient-to-r from-purple-600/80 to-violet-700/60 text-white shadow-[0_0_28px_rgba(124,58,237,0.32)]"
                        : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
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
                      <SidebarIcon
                        name={item.icon}
                        className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-gray-500 group-hover:text-gray-300"}`}
                      />
                    </motion.span>
                    <span className="relative z-[1]">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="space-y-4 p-4">
              {isRestaurantUser && primaryRestaurant && restaurantHref ? (
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
              ) : null}

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

              <div className="flex items-center gap-3 border-t border-white/[0.08] pt-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-300/40 bg-purple-500/10 text-xs font-semibold text-purple-100">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  <p className="truncate text-xs text-gray-500">{roleLabel}</p>
                </div>
              </div>

              <LogoutButton />

              {showSettings ? (
              <Link
                href={settingsHref}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition ${
                  settingsActive
                    ? "bg-white/[0.06] text-white"
                    : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <SidebarIcon name="settings" className="h-4 w-4" />
                <span>Configuración</span>
              </Link>
              ) : null}
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
