/**
 * Tipos unificados de la plataforma Nexo Origen.
 * Alias sobre los modelos de dominio en lib/* — listos para mapear tablas Supabase.
 */

import type { RestaurantAlert } from "@/lib/alerts/types";
import type { PreventStatus } from "@/lib/prevent/types";
import type { ReportRecord } from "@/lib/reports/types";
import type { RestaurantOperational } from "@/lib/restaurants/types";
import type { Review } from "@/lib/reviews/types";
import type { EmployeeMention, EmployeeRecord } from "@/lib/talento/types";
import type { BrandId } from "@/app/dashboard/restaurantes/data";

/** Marca / cadena dentro del tenant. */
export type Brand = {
  id: BrandId;
  name: string;
};

/** Restaurante operativo en la red. */
export type Restaurant = RestaurantOperational;

/** Reseña de cliente. */
export type { Review };

/** Incidencia reputacional por restaurante. */
export type Alert = RestaurantAlert;

/** Informe ejecutivo. */
export type Report = ReportRecord;

/** Mención de empleado en reseña (IA). */
export type TalentMention = EmployeeMention;

/** Empleado agregado con menciones. */
export type TalentEmployee = EmployeeRecord;

/** Estado de prevención reputacional. */
export type { PreventStatus };

/** Estado operativo unificado de la red. */
export type OperationalStatus = "on_target" | "watch" | "critical";

/** Etiquetas de negocio en español. */
export type StatusLabel = "Protegido" | "Vigilancia" | "Riesgo" | "Crítico" | "Resuelta";
