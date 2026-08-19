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

/**
 * Fixture de prueba visual para la plantilla de Burger King — con todos los
 * campos de análisis IA rellenos (texto de ejemplo, no un caso real) para
 * comprobar el diseño normal (comentario ≤900 caracteres) completo.
 */
export const SAMPLE_BK_FULL: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT,
  review_comment:
    "Fuimos a cenar un sábado por la noche, y la experiencia fue bastante decepcionante de principio a fin. Empezamos esperando casi 20 minutos largos solo para que nos tomaran el pedido, a pesar de que el local no estaba especialmente lleno esa noche. Cuando por fin llegó la comida, una de las hamburguesas venía sin queso a pesar de que lo habíamos pedido expresamente, y las patatas estaban frías, como si llevaran bastante tiempo hechas antes de servirlas. Pedimos amablemente que nos las cambiaran y tardaron otros diez minutos largos en traernos unas nuevas, que tampoco estaban muy calientes de verdad. El refresco bien grande que pedimos nos lo sirvieron en un vaso mediano sin darnos ninguna explicación al respecto en ningún momento. Cuando comentamos todo esto al camarero, se limitó a disculparse sin ofrecernos ningún tipo de compensación, y eso es lo que más nos ha molestado de la visita.",
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

/**
 * Fixture de prueba visual — comentario corto (texto de ejemplo, no un caso
 * real) para comprobar el diseño normal con un comentario breve.
 */
export const SAMPLE_BK_SHORT: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT,
  review_author: "Carlos Ruiz",
  review_comment:
    "La comida llegó fría y la atención fue bastante lenta, tuvimos que esperar más de 20 minutos solo para que nos tomaran el pedido. Además, una de las hamburguesas venía sin salsa a pesar de haberla pedido. No creo que volvamos pronto a este restaurante.",
  previous_rating: 4.41,
  current_rating: 4.18,
  rating_impact: -0.41,
  review_count: 312,
  lifetime_rating: 4.18,
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

/**
 * Fixture de prueba visual — comentario > 900 caracteres (texto de ejemplo,
 * no un caso real) para comprobar el diseño largo (centrado, solo
 * comentario + Impacto en la media).
 */
export const SAMPLE_BK_LONG: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT,
  review_author: "Marta Sánchez",
  review_comment:
    "Pedimos a domicilio y la experiencia fue de las peores que hemos tenido con esta cadena. Para empezar, el pedido tardó más de una hora en llegar, cuando la propia aplicación indicaba entre 30 y 40 minutos. Cuando por fin llegó, faltaban dos de las hamburguesas que habíamos pedido y una de las que sí venían tenía el pan completamente empapado, como si llevara mucho tiempo hecha antes de salir del local. Las patatas venían frías y sin sal, y el refresco grande que pedimos era en realidad uno mediano. Llamamos al restaurante para explicar la situación y nos dijeron que no podían hacer nada porque el pedido ya figuraba como entregado en su sistema, así que tuvimos que reclamar directamente a través de la aplicación, algo que no nos habían explicado hasta ese momento. Es la segunda vez en el último mes que tenemos un problema parecido con este mismo restaurante, y cada vez es más difícil que nos den una solución razonable sin tener que insistir varias veces. Entendemos que puede haber errores puntuales, pero la falta de comunicación y la actitud a la hora de resolverlo es lo que de verdad nos ha decepcionado.",
  previous_rating: 4.28,
  current_rating: 4.05,
  rating_impact: -0.23,
  review_count: 501,
  lifetime_rating: 4.05,
  detected_reasons: [],
  sentiment: "Muy negativo",
  risk_level: "ALTO",
  recommendation:
    "Revisar el proceso de reparto y los tiempos de entrega, confirmar pedidos completos antes de salir del local y mejorar la comunicación con el cliente sobre cómo reclamar cuando hay una incidencia.",
  ai_summary:
    "La clienta recibió un pedido a domicilio con más de una hora de retraso, faltaban productos, la comida llegó fría y el tamaño de una bebida no coincidía con lo pedido. Es la segunda incidencia similar en el último mes.",
  main_motive: "Retraso considerable en la entrega, pedido incompleto y productos de menor calidad/tamaño al solicitado.",
  detected_impact:
    "La clienta está muy insatisfecha por la reincidencia del problema y la falta de una solución clara, lo que afecta a su confianza en el servicio de reparto.",
  employee_mentioned: null,
  analisis_pending: false,
};
