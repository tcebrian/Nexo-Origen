import type { DashboardSection, UserRole, UserScope } from "@/lib/auth/types";
import { canAccessSection } from "@/lib/auth/permissions";

const SECTION_PATHS: { section: DashboardSection; prefix: string }[] = [
  { section: "informes", prefix: "/dashboard/informes" },
  { section: "talento", prefix: "/dashboard/talento" },
  { section: "ajustes", prefix: "/dashboard/ajustes" },
  { section: "insights-ia", prefix: "/dashboard/insights-ia" },
  { section: "nexo-prevent", prefix: "/dashboard/nexo-prevent" },
  { section: "ranking", prefix: "/dashboard/ranking" },
  { section: "alertas", prefix: "/dashboard/alertas" },
  { section: "resenas", prefix: "/dashboard/resenas" },
  { section: "restaurantes", prefix: "/dashboard/restaurantes" },
  { section: "home", prefix: "/dashboard" },
];

export function resolveDashboardSection(pathname: string): DashboardSection {
  const normalized = pathname.split("?")[0] ?? pathname;

  for (const { section, prefix } of SECTION_PATHS) {
    if (section === "home") {
      if (normalized === "/dashboard") return "home";
      continue;
    }
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return section;
    }
  }

  return "home";
}

export function canAccessDashboardPath(rol: UserRole | null | undefined, pathname: string): boolean {
  const section = resolveDashboardSection(pathname);
  return canAccessSection(rol, section);
}

export function isProtectedApiPath(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  // Rutas que se autentican por su cuenta (token compartido en vez de sesión
  // de usuario) porque las llaman servicios externos sin cookies: Supabase
  // Database Webhooks y Twilio pidiendo la imagen del aviso de WhatsApp.
  const publicPrefixes = [
    "/api/auth/",
    "/api/webhooks/",
    "/api/notifications/whatsapp-alert-image",
  ];
  return !publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function isSuperAdminApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/informes") ||
    pathname.startsWith("/api/reports/") ||
    pathname.startsWith("/api/platform/")
  );
}
