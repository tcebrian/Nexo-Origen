/** KPIs del informe — calculados desde Supabase. */
export type InformeKpiDatos = {
  media: number;
  resenas: number;
  negativas: number;
  restaurantes: number;
};

export type InformeEstado = "verde" | "amarillo" | "rojo";

export type InformeMarcaCoverMeta = {
  restauranteDisplay: string;
  periodTitle: string;
  periodRange: string;
  cliente: string;
  variacionMedia: number | null;
  variacionLabel: string;
  coverImageDataUri: string | null;
  /** Nombre de la marca en mayúsculas para la línea 1 del bloque restaurante (ej: "BURGER KING") */
  marcaDisplay?: string;
  /** Etiqueta del periodo anterior para el KPI de variación (ej: "VS MAYO") */
  variacionPeriodLabel?: string;
  /** Tipo de análisis para el subtítulo (ej: "semanal", "mensual") */
  analisisTipo?: string;
  /** Nombre de marca para resolver logo (ej: "Burger King") */
  marca?: string;
};

export type InformeMarcaDatos = InformeKpiDatos & {
  marca: string;
  estado: InformeEstado;
  estadoLabel: string;
  cover: InformeMarcaCoverMeta;
};

/** Datos de portada + KPIs para render HTML. */
export type InformeCoverDatos = InformeKpiDatos &
  InformeMarcaCoverMeta & {
    estado: InformeEstado;
    estadoLabel: string;
  };
