import { NEXO_ORIGEN_LOGO_SRC } from "@/app/_components/nexo-brand";
import { IA_NO_DATA } from "@/lib/reviews/analisis-ia-constants";
import type { NegativeReviewAlertData } from "./types";

const SAMPLE_IA_FIELDS = {
  risk_level: "ALTO",
  detected_reasons: [] as string[],
  sentiment: IA_NO_DATA,
  recommendation: IA_NO_DATA,
  ai_summary: null,
  analisis_pending: true,
} as const;

/** Datos de layout para preview — sin análisis IA inventado. */
export const SAMPLE_NEGATIVE_REVIEW_ALERT: NegativeReviewAlertData = {
  brand: "bk",
  brand_name: "Burger King",
  brand_logo_url: "/brands/burger-king-transparent.png",
  restaurant_name: "BK UTEBO",
  restaurant_location: "Utebo, Zaragoza",
  restaurant_address: "Av. Zaragoza, s/n, 50180 Utebo, Zaragoza",
  review_author: "Laura Martínez",
  review_date: "24 MAY 2025",
  review_time: "11:35",
  review_stars: 1,
  review_comment:
    "Después de esperar más de 25 minutos para que nos atendieran, la comida llegó fría y además faltaban productos del pedido. El personal no nos ofreció ninguna solución y parecían desorganizados. No es la primera vez que tenemos una mala experiencia en este restaurante. Muy decepcionados.",
  previous_rating: 4.41,
  current_rating: 4.18,
  rating_impact: -0.41,
  review_count: 312,
  lifetime_rating: 4.18,
  source: "Google Maps",
  nexo_logo_url: NEXO_ORIGEN_LOGO_SRC,
  report_date: "24 MAY 2025, 11:48 AM",
  aspect_ratio: "4:3",
  ...SAMPLE_IA_FIELDS,
};

export const SAMPLE_SHORT_COMMENT: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT,
  review_comment: "Comida fría y muy lenta la atención. No volveré.",
  review_author: "Carlos Ruiz",
  detected_reasons: ["Comida fría", "Lentitud"],
  sentiment: "Negativo",
  risk_level: "MEDIO",
  recommendation: "Revisar los tiempos de servicio y la temperatura de entrega del pedido.",
  ai_summary: "Cliente insatisfecho por comida fría y atención lenta.",
  main_motive: "Comida fría",
  detected_impact: "Posible bajada leve en la media si se repite.",
  employee_mentioned: null,
  analisis_pending: false,
};

export const SAMPLE_MEDIUM_COMMENT: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT,
  review_comment:
    "Esperamos más de 20 minutos y el pedido llegó incompleto. El personal no mostró interés en solucionarlo.",
  review_author: "Ana García",
};

export const SAMPLE_EXTRA_LONG_COMMENT: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT,
  review_comment:
    "Después de esperar más de 25 minutos para que nos atendieran, la comida llegó fría y además faltaban productos del pedido. El personal no nos ofreció ninguna solución y parecían desorganizados. No es la primera vez que tenemos una mala experiencia en este restaurante. Muy decepcionados. Además el local estaba sucio y la actitud del encargado fue pésima cuando reclamamos. Llevamos años viniendo y cada vez empeora más la calidad del servicio.",
};

export const SAMPLE_ZIZUR_MAYOR: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT,
  brand_name: "Burger King",
  restaurant_name: "BK ZIZUR MAYOR",
  restaurant_location: "Navarra, España",
  restaurant_address: "Navarra, España",
  review_author: "Fernando",
  review_date: "14 JUN 2026",
  review_time: "19:31",
  review_comment:
    "El local estaba bastante sucio, mesas sin recoger y baños en mal estado. Pedimos un producto del menú y nos dijeron que no lo tenían sin ofrecer alternativa. La actitud del personal fue indiferente. No volveremos hasta que mejoren la limpieza y la organización del servicio.",
  previous_rating: 4.76,
  current_rating: 4.62,
  rating_impact: -0.14,
  review_count: 248,
  lifetime_rating: 4.62,
  report_date: "14 JUN 2026, 07:31 PM",
};

/**
 * Fixture de prueba visual para la plantilla de Burger King — con todos los
 * campos de análisis IA rellenos (texto de ejemplo, no un caso real) para
 * comprobar el diseño completo, no solo el layout con placeholders vacíos.
 */
export const SAMPLE_BK_FULL: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT,
  detected_reasons: ["Tiempo de espera", "Pedido incompleto", "Atención al cliente"],
  sentiment: "Negativo",
  risk_level: "ALTO",
  recommendation:
    "Reforzar personal en hora punta y revisar el proceso de verificación de pedidos antes de la entrega.",
  ai_summary:
    "Cliente reporta una espera excesiva y un pedido incompleto, con una atención percibida como poco resolutiva.",
  main_motive: "Tiempo de espera",
  detected_impact: "Bajada de 0.23 puntos en la media del local en el periodo analizado.",
  employee_mentioned: null,
  analisis_pending: false,
  period_label: "18 may 2025 – 24 may 2025",
};
