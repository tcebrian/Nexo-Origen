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

/** Datos base de layout para preview de Popeyes — sin análisis IA inventado. */
const SAMPLE_NEGATIVE_REVIEW_ALERT_PP: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT,
  brand: "pp",
  brand_name: "Popeyes",
  brand_logo_url: "/brands/popeyes-transparent.png",
  restaurant_name: "PP ZARAGOZA CENTRO",
  restaurant_location: "Zaragoza",
  restaurant_address: "Paseo de la Independencia, 12, 50004 Zaragoza",
};

/**
 * Fixture de prueba visual para la plantilla de Popeyes — con todos los
 * campos de análisis IA rellenos (texto de ejemplo, no un caso real) para
 * comprobar el diseño normal (comentario ≤900 caracteres) completo.
 */
export const SAMPLE_PP_FULL: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT_PP,
  review_author: "Sara Domínguez",
  review_comment:
    "Pedimos un combo de tenders con patatas cajún y una bebida grande, y la experiencia fue bastante floja para lo que cuesta. Los tenders venían templados, no calientes de verdad, como si llevaran ya un rato hechos antes de servirlos. Las patatas cajún, que suelen ser lo mejor de la carta, estaban blandas y con muy poco del toque picante que las caracteriza. Pedimos que nos las cambiaran por unas recién hechas y tardaron casi quince minutos en traer un pedido tan sencillo, con la tienda medio vacía además. La bebida grande que pagamos de más nos la sirvieron prácticamente sin hielo, así que se quedó caliente enseguida. Cuando comentamos la espera en el mostrador, la persona que nos atendió se limitó a encogerse de hombros sin ofrecer ninguna disculpa ni compensación por la tardanza.",
  detected_reasons: ["Comida templada", "Tiempo de espera", "Atención al cliente"],
  sentiment: "Negativo",
  risk_level: "ALTO",
  recommendation:
    "Revisar el mantenimiento de temperatura de tenders y patatas en el punto de calor, y reforzar personal en cocina en horas valle para evitar reprocesos lentos.",
  ai_summary:
    "Cliente reporta comida templada (tenders y patatas cajún) y una espera larga para un pedido sencillo, con atención percibida como poco resolutiva.",
  main_motive: "Comida templada",
  detected_impact: "Bajada de 0.19 puntos en la media del local en el periodo analizado.",
  employee_mentioned: null,
  analisis_pending: false,
  period_label: "18 may 2025 – 24 may 2025",
};

/**
 * Fixture de prueba visual — comentario corto (texto de ejemplo, no un caso
 * real) para comprobar el diseño normal de Popeyes con un comentario breve.
 */
export const SAMPLE_PP_SHORT: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT_PP,
  review_author: "Iván Castro",
  review_comment:
    "Los tenders llegaron fríos por dentro y las patatas cajún estaban ya frías del todo, tuvimos que esperar bastante para que nos tomaran nota a pesar de haber poca gente. No fue la experiencia que esperaba de Popeyes, la verdad.",
  previous_rating: 4.36,
  current_rating: 4.15,
  rating_impact: -0.21,
  review_count: 268,
  lifetime_rating: 4.15,
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
 * no un caso real) para comprobar el diseño largo de Popeyes (centrado,
 * solo comentario + Impacto en la media).
 */
export const SAMPLE_PP_LONG: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT_PP,
  review_author: "Nuria Vidal",
  review_comment:
    "Pedimos a domicilio un cubo de tenders para compartir y la experiencia fue de las peores que hemos tenido con esta cadena. Para empezar, el pedido tardó casi una hora en llegar cuando la aplicación indicaba entre 25 y 35 minutos. Cuando por fin llegó, faltaba una de las salsas que habíamos pedido expresamente y varios de los tenders venían con un rebozado completamente blando, como si el pedido llevara mucho tiempo esperando antes de salir del local. Las patatas cajún venían frías y prácticamente sin especias, y el refresco grande que pedimos era en realidad uno mediano, sin ninguna explicación al respecto. Llamamos al restaurante para explicar la situación y nos dijeron que no podían hacer nada porque el pedido ya figuraba como entregado en su sistema, así que tuvimos que reclamar directamente a través de la aplicación de reparto, algo que no nos habían explicado hasta ese momento. Es la segunda vez en el último mes que tenemos un problema parecido con este mismo restaurante, y cada vez es más difícil que nos den una solución razonable sin tener que insistir varias veces. Entendemos que puede haber errores puntuales, pero la falta de comunicación y la actitud a la hora de resolverlo es lo que de verdad nos ha decepcionado.",
  previous_rating: 4.24,
  current_rating: 4.02,
  rating_impact: -0.22,
  review_count: 415,
  lifetime_rating: 4.02,
  detected_reasons: [],
  sentiment: "Muy negativo",
  risk_level: "ALTO",
  recommendation:
    "Revisar el proceso de reparto y los tiempos de entrega, confirmar pedidos completos antes de salir del local y mejorar la comunicación con el cliente sobre cómo reclamar cuando hay una incidencia.",
  ai_summary:
    "La clienta recibió un pedido a domicilio con casi una hora de retraso, faltaba una salsa, parte de los tenders llegaron blandos y el tamaño de la bebida no coincidía con lo pedido. Es la segunda incidencia similar en el último mes.",
  main_motive: "Retraso considerable en la entrega, pedido incompleto y productos de menor calidad al solicitado.",
  detected_impact:
    "La clienta está muy insatisfecha por la reincidencia del problema y la falta de una solución clara, lo que afecta a su confianza en el servicio de reparto.",
  employee_mentioned: null,
  analisis_pending: false,
};

/** Datos base de layout para preview de Santa Gloria — sin análisis IA inventado. */
const SAMPLE_NEGATIVE_REVIEW_ALERT_SG: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT,
  brand: "sg",
  brand_name: "Santa Gloria",
  brand_logo_url: "/brands/santa-gloria-transparent.png",
  restaurant_name: "SG ZARAGOZA CENTRO",
  restaurant_location: "Zaragoza",
  restaurant_address: "Paseo de la Independencia, 24, 50004 Zaragoza",
};

/**
 * Fixture de prueba visual para la plantilla de Santa Gloria — con todos
 * los campos de análisis IA rellenos (texto de ejemplo, no un caso real)
 * para comprobar el diseño normal (comentario ≤900 caracteres) completo.
 */
export const SAMPLE_SG_FULL: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT_SG,
  review_author: "Elena Ferrer",
  review_comment:
    "Fuimos a desayunar un sábado y pedimos dos cafés con leche y un par de croissants de mantequilla, y la experiencia dejó bastante que desear para el precio que tiene el local. Los cafés tardaron casi veinte minutos en salir a pesar de que solo había dos mesas ocupadas, y cuando llegaron estaban tibios, no calientes de verdad. Los croissants no eran del día, se notaban claramente correosos por dentro, como si llevaran ya un tiempo hechos. Pedimos que nos los cambiaran y la persona que nos atendió puso bastante mala cara, como si le molestara la petición, aunque al final sí nos trajo otros que tampoco estaban recién horneados. La mesa además llevaba sin limpiar desde el cliente anterior cuando nos sentamos, tuvimos que pedir que la limpiaran nosotros mismos. Por el precio que tiene Santa Gloria esperábamos bastante más cuidado, tanto en el producto como en el trato.",
  detected_reasons: ["Producto no fresco", "Tiempo de espera", "Atención al cliente"],
  sentiment: "Negativo",
  risk_level: "ALTO",
  recommendation:
    "Revisar la rotación de bollería para asegurar producto del día y reforzar la formación de atención al cliente en el trato ante quejas.",
  ai_summary:
    "Cliente reporta bollería no fresca y café tibio, con una espera larga y una atención percibida como poco amable ante la reclamación.",
  main_motive: "Producto no fresco",
  detected_impact: "Bajada de 0.18 puntos en la media del local en el periodo analizado.",
  employee_mentioned: null,
  analisis_pending: false,
  period_label: "18 may 2025 – 24 may 2025",
};

/**
 * Fixture de prueba visual — comentario corto (texto de ejemplo, no un caso
 * real) para comprobar el diseño normal de Santa Gloria con un comentario breve.
 */
export const SAMPLE_SG_SHORT: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT_SG,
  review_author: "Marcos Iglesias",
  review_comment:
    "El café con leche llegó frío y el bizcocho de la vitrina estaba reseco, se notaba que no era del día. Tardaron mucho en atendernos a pesar de que el local estaba prácticamente vacío a esa hora.",
  previous_rating: 4.52,
  current_rating: 4.33,
  rating_impact: -0.19,
  review_count: 194,
  lifetime_rating: 4.33,
  detected_reasons: ["Producto no fresco", "Lentitud"],
  sentiment: "Negativo",
  risk_level: "MEDIO",
  recommendation: "Revisar la temperatura de servicio del café y la rotación de bollería.",
  ai_summary: "Cliente insatisfecho por café frío y bollería reseca.",
  main_motive: "Producto no fresco",
  detected_impact: "Posible bajada leve en la media si se repite.",
  employee_mentioned: null,
  analisis_pending: false,
};

/**
 * Fixture de prueba visual — comentario > 900 caracteres (texto de ejemplo,
 * no un caso real) para comprobar el diseño largo de Santa Gloria (centrado,
 * solo comentario + Impacto en la media).
 */
export const SAMPLE_SG_LONG: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT_SG,
  review_author: "Patricia Nuño",
  review_comment:
    "Reservamos una mesa para merendar con mi madre y la experiencia fue de las peores que hemos tenido en esta cadena, la verdad. Para empezar, a pesar de tener la reserva confirmada por la aplicación, al llegar nos dijeron que no había mesa libre y tuvimos que esperar de pie casi veinticinco minutos en la puerta. Cuando por fin nos sentaron, pedimos una tarta de queso y dos infusiones, y la tarta llegó con la base claramente húmeda, como si hubiera estado mucho tiempo en la nevera sin protección adecuada. Una de las infusiones vino fría cuando la habíamos pedido caliente, y al avisarlo tardaron otros diez minutos en traer una nueva. La vajilla que nos pusieron además no estaba del todo limpia, con restos visibles en el borde de una de las tazas. Cuando comentamos todo esto al camarero al pagar, se limitó a disculparse de forma muy seca sin ofrecer ningún tipo de compensación por la reserva incumplida ni por el resto de incidencias. Es la segunda vez que tenemos un problema parecido en este mismo local, y cada vez nos genera menos confianza volver a repetir.",
  previous_rating: 4.48,
  current_rating: 4.24,
  rating_impact: -0.24,
  review_count: 322,
  lifetime_rating: 4.24,
  detected_reasons: [],
  sentiment: "Muy negativo",
  risk_level: "ALTO",
  recommendation:
    "Revisar el sistema de reservas para que se respete la disponibilidad real de mesas, reforzar la limpieza de vajilla y la conservación de la bollería y tartas refrigeradas.",
  ai_summary:
    "La clienta tuvo que esperar de pie pese a tener reserva confirmada, recibió una tarta con la base húmeda y una infusión fría, y la vajilla no estaba del todo limpia. Es la segunda incidencia similar en el mismo local.",
  main_motive: "Reserva no respetada, producto en mal estado y vajilla poco limpia.",
  detected_impact:
    "La clienta está muy insatisfecha por la reincidencia del problema y la falta de una disculpa con compensación real, lo que afecta a su confianza en el local.",
  employee_mentioned: null,
  analisis_pending: false,
};

/** Datos base de layout para preview de Ribs — sin análisis IA inventado. */
const SAMPLE_NEGATIVE_REVIEW_ALERT_RIBS: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT,
  brand: "ribs",
  brand_name: "Ribs",
  brand_logo_url: "/brands/ribs-transparent.png",
  restaurant_name: "RIBS LLEIDA",
  restaurant_location: "Lleida",
  restaurant_address: "Avinguda de Blondel, 26, 25002 Lleida",
};

/**
 * Fixture de prueba visual para la plantilla de Ribs — con todos los
 * campos de análisis IA rellenos (texto de ejemplo, no un caso real) para
 * comprobar el diseño normal (comentario ≤900 caracteres) completo.
 */
export const SAMPLE_RIBS_FULL: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT_RIBS,
  review_author: "Javier Molina",
  review_comment:
    "Pedimos el costillar grande para compartir con una ración de alitas, y la experiencia dejó bastante que desear para el precio que tiene el local. Las costillas venían prácticamente frías por dentro, como si hubieran salido de la nevera hacía poco y no las hubieran vuelto a calentar del todo, y la salsa barbacoa estaba servida aparte cuando la carta indica que vienen glaseadas. Tardaron casi media hora en traer el pedido a pesar de que el local no estaba lleno esa noche. Cuando avisamos de que la carne estaba fría, la persona que nos atendió se limitó a decir que así se sirve y no ofreció cambiarla ni ningún tipo de disculpa. Las alitas sí que estaban bien, todo hay que decirlo, pero entre la espera y la carne fría la experiencia general fue bastante decepcionante para lo que cuesta.",
  detected_reasons: ["Comida fría", "Tiempo de espera", "Atención al cliente"],
  sentiment: "Negativo",
  risk_level: "ALTO",
  recommendation:
    "Revisar el mantenimiento de temperatura de las costillas en el punto de calor y reforzar la formación de sala para gestionar quejas con una disculpa o compensación real.",
  ai_summary:
    "Cliente reporta costillar frío y salsa servida aparte en vez de glaseada, con una espera larga y una atención percibida como poco resolutiva.",
  main_motive: "Comida fría",
  detected_impact: "Bajada de 0.21 puntos en la media del local en el periodo analizado.",
  employee_mentioned: null,
  analisis_pending: false,
  period_label: "18 may 2025 – 24 may 2025",
};

/**
 * Fixture de prueba visual — comentario corto (texto de ejemplo, no un caso
 * real) para comprobar el diseño normal de Ribs con un comentario breve.
 */
export const SAMPLE_RIBS_SHORT: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT_RIBS,
  review_author: "Cristina Peña",
  review_comment:
    "Las costillas estaban duras y algo frías, y tuvimos que esperar más de veinte minutos aunque el local estaba medio vacío. Por el precio que tiene, esperaba bastante más.",
  previous_rating: 4.33,
  current_rating: 4.12,
  rating_impact: -0.21,
  review_count: 221,
  lifetime_rating: 4.12,
  detected_reasons: ["Comida fría", "Lentitud"],
  sentiment: "Negativo",
  risk_level: "MEDIO",
  recommendation: "Revisar los tiempos de servicio y la temperatura de entrega de las costillas.",
  ai_summary: "Cliente insatisfecho por costillas duras y frías, con atención lenta.",
  main_motive: "Comida fría",
  detected_impact: "Posible bajada leve en la media si se repite.",
  employee_mentioned: null,
  analisis_pending: false,
};

/**
 * Fixture de prueba visual — comentario > 900 caracteres (texto de ejemplo,
 * no un caso real) para comprobar el diseño largo de Ribs (centrado, solo
 * comentario + Impacto en la media).
 */
export const SAMPLE_RIBS_LONG: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT_RIBS,
  review_author: "Rubén Castillo",
  review_comment:
    "Fuimos a celebrar un cumpleaños en grupo y reservamos con antelación, y la experiencia fue de las peores que hemos tenido en esta cadena. Para empezar, a pesar de la reserva confirmada, al llegar nos dijeron que la mesa no estaba lista y tuvimos que esperar de pie casi veinte minutos en la entrada. Cuando por fin nos sentaron, pedimos varios costillares y una ración de patatas para compartir, y la mitad de los platos llegaron fríos mientras el resto seguía en cocina, así que unos empezaron a comer mientras otros esperaban todavía su plato. Una de las raciones de costillas venía con bastante menos carne de lo habitual, casi solo hueso, y al comentarlo nos dijeron que así había salido esa pieza sin ofrecer cambiarla. Las patatas llegaron frías y grasientas, como si llevaran tiempo hechas. Cuando pedimos hablar con alguien responsable para comentar todo esto, tardaron otros quince minutos en atendernos y la respuesta fue bastante seca, sin ninguna compensación por una reserva de cumpleaños que se suponía especial. Es la segunda vez que tenemos un problema parecido en este mismo local, y cada vez nos genera menos confianza volver a repetir.",
  previous_rating: 4.19,
  current_rating: 3.95,
  rating_impact: -0.24,
  review_count: 287,
  lifetime_rating: 3.95,
  detected_reasons: [],
  sentiment: "Muy negativo",
  risk_level: "ALTO",
  recommendation:
    "Revisar el sistema de reservas para grupos, coordinar la salida conjunta de platos en cocina y reforzar la formación de sala para resolver incidencias con una compensación real.",
  ai_summary:
    "El cliente tuvo que esperar pese a tener reserva, los platos llegaron descoordinados y fríos, una ración de costillas venía con poca carne y la gestión de la queja fue lenta y sin compensación. Es la segunda incidencia similar en el mismo local.",
  main_motive: "Reserva no respetada, platos descoordinados y producto por debajo de lo esperado.",
  detected_impact:
    "El cliente está muy insatisfecho por la reincidencia del problema y la falta de una disculpa con compensación real, lo que afecta a su confianza en el local.",
  employee_mentioned: null,
  analisis_pending: false,
};

/** Datos base de layout para preview de Tim Hortons — sin análisis IA inventado. */
const SAMPLE_NEGATIVE_REVIEW_ALERT_TH: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT,
  brand: "th",
  brand_name: "Tim Hortons",
  brand_logo_url: "/brands/tim-hortons-transparent.png",
  restaurant_name: "TIM HORTONS MADRID",
  restaurant_location: "Madrid",
  restaurant_address: "Calle de Preciados, 3, 28013 Madrid",
};

/**
 * Fixture de prueba visual para la plantilla de Tim Hortons — con todos los
 * campos de análisis IA rellenos (texto de ejemplo, no un caso real) para
 * comprobar el diseño normal (comentario ≤900 caracteres) completo.
 */
export const SAMPLE_TH_FULL: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT_TH,
  review_author: "Marta Sánchez",
  review_comment:
    "Pedí un café con leche y un donut para llevar, y el café estaba prácticamente frío cuando lo probé fuera del local, a pesar de que acababan de servírmelo. Además tardaron casi quince minutos en atenderme a pesar de que solo había dos personas por delante en la cola, algo que no había pasado nunca en este mismo local. El donut sí estaba bien, recién hecho, pero entre la espera y el café frío la experiencia general no fue nada buena para lo que suele ser este sitio.",
  detected_reasons: ["Bebida fría", "Tiempo de espera"],
  sentiment: "Negativo",
  risk_level: "MEDIO",
  recommendation:
    "Revisar el mantenimiento de temperatura en la zona de bebidas calientes y reforzar personal en hora punta para reducir los tiempos de cola.",
  ai_summary:
    "Cliente reporta café frío pese a servirse en el momento y una espera larga para el volumen de cola que había.",
  main_motive: "Bebida fría",
  detected_impact: "Bajada de 0.14 puntos en la media del local en el periodo analizado.",
  employee_mentioned: null,
  analisis_pending: false,
  period_label: "18 may 2025 – 24 may 2025",
};

/**
 * Fixture de prueba visual — comentario corto (texto de ejemplo, no un caso
 * real) para comprobar el diseño normal de Tim Hortons con un comentario breve.
 */
export const SAMPLE_TH_SHORT: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT_TH,
  review_author: "David Romero",
  review_comment:
    "El café llegó frío y tuvimos que esperar más de diez minutos con la tienda casi vacía. Por lo que suele costar aquí, esperaba bastante más rapidez.",
  previous_rating: 4.33,
  current_rating: 4.19,
  rating_impact: -0.14,
  review_count: 198,
  lifetime_rating: 4.19,
  detected_reasons: ["Bebida fría", "Lentitud"],
  sentiment: "Negativo",
  risk_level: "MEDIO",
  recommendation: "Revisar los tiempos de servicio y la temperatura de entrega de las bebidas calientes.",
  ai_summary: "Cliente insatisfecho por café frío y atención lenta.",
  main_motive: "Bebida fría",
  detected_impact: "Posible bajada leve en la media si se repite.",
  employee_mentioned: null,
  analisis_pending: false,
};

/**
 * Fixture de prueba visual — comentario > 900 caracteres (texto de ejemplo,
 * no un caso real) para comprobar el diseño largo de Tim Hortons (centrado,
 * solo comentario + Impacto en la media).
 */
export const SAMPLE_TH_LONG: NegativeReviewAlertData = {
  ...SAMPLE_NEGATIVE_REVIEW_ALERT_TH,
  review_author: "Laura Gimeno",
  review_comment:
    "Fuimos varios compañeros de trabajo a desayunar antes de una reunión y la experiencia fue de las peores que hemos tenido en esta cadena. Pedimos varios cafés, un par de tés y una selección de donuts y bagels, y desde el principio la cola avanzaba muy despacio a pesar de que había tres personas detrás del mostrador. Cuando por fin nos sirvieron, la mitad de los cafés llegaron fríos mientras los tés todavía tardaron otros diez minutos más en salir, así que unos empezamos a desayunar mientras otros seguían esperando su bebida. Uno de los bagels venía prácticamente sin relleno, casi solo pan, y al comentarlo en el mostrador nos dijeron que así se sirve esa variedad sin ofrecer cambiarlo. Los donuts llegaron correctos, eso hay que decirlo, pero entre la espera y las bebidas frías la experiencia general fue bastante decepcionante justo antes de entrar a una reunión importante. Cuando pedimos hablar con alguien responsable, tardaron otros diez minutos en atendernos y la respuesta fue bastante seca, sin ninguna compensación. Es la segunda vez que tenemos un problema parecido en este mismo local, y cada vez nos genera menos confianza volver a repetir antes del trabajo.",
  previous_rating: 4.19,
  current_rating: 3.99,
  rating_impact: -0.2,
  review_count: 254,
  lifetime_rating: 3.99,
  detected_reasons: [],
  sentiment: "Muy negativo",
  risk_level: "ALTO",
  recommendation:
    "Reforzar personal en hora punta de mañana, revisar el mantenimiento de temperatura de las bebidas y formar a sala para resolver incidencias con una compensación real.",
  ai_summary:
    "El grupo esperó más de lo normal con poca afluencia, varias bebidas llegaron frías y descoordinadas, un bagel venía con poco relleno y la gestión de la queja fue lenta y sin compensación. Es la segunda incidencia similar en el mismo local.",
  main_motive: "Espera larga, bebidas descoordinadas y producto por debajo de lo esperado.",
  detected_impact:
    "El cliente está muy insatisfecho por la reincidencia del problema y la falta de una disculpa con compensación real, lo que afecta a su confianza en el local.",
  employee_mentioned: null,
  analisis_pending: false,
};
