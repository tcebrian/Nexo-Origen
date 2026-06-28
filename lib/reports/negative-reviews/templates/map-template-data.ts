import { NEXO_ORIGEN_LOGO_SRC } from "@/app/_components/nexo-brand";
import type { BrandId } from "@/app/dashboard/restaurantes/data";
import { BRAND_VISUALS } from "@/lib/restaurants/brand-visuals";
import type { NegativeReviewReportRow } from "../types";
import { NEGATIVE_REVIEW_DECOR_ASSETS, resolveDecorAssetUrl } from "./assets";
import { resolveCityLabel } from "./resolve-local";
import type { NegativeReviewTemplateData, TemplateListItem } from "./template-data";

const BRAND_DISPLAY_NAMES: Partial<Record<BrandId, string>> = {
  bk: "BURGER KING",
};

function resolveBrandDisplayName(brand: BrandId, brandLabel: string): string {
  return BRAND_DISPLAY_NAMES[brand] ?? brandLabel.toUpperCase();
}

function assetUrl(base: string | undefined, path: string) {
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path}`;
}

function getAuthorInitial(author: string): string {
  const trimmed = author.trim();
  if (!trimmed || trimmed === "Anónimo") return "?";
  return trimmed.charAt(0).toUpperCase();
}

function formatReviewDateTime(dateIso: string): { date: string; time: string } {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) {
    return { date: "—", time: "—" };
  }

  const dd = String(parsed.getDate()).padStart(2, "0");
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const yyyy = parsed.getFullYear();
  const hh = String(parsed.getHours()).padStart(2, "0");
  const min = String(parsed.getMinutes()).padStart(2, "0");
  const ss = String(parsed.getSeconds()).padStart(2, "0");

  return {
    date: `${dd}-${mm}-${yyyy}`,
    time: `${hh}:${min}:${ss}`,
  };
}

function deriveSubScores(stars: number, motive: string, comment: string) {
  const lower = `${motive} ${comment}`.toLowerCase();
  let food = stars;
  let service = stars;
  let atmosphere = stars;

  if (/calidad|producto|comida|frí|frio|temperatura|pedido|helado|derret/.test(lower)) {
    food = Math.max(1, stars);
  }
  if (/atención|atencion|espera|servicio|caja|personal|teléfono|telefono|minut/.test(lower)) {
    service = Math.max(1, stars);
  }
  if (/limpieza|higiene|ambiente|ruido|satur|cucarach/.test(lower)) {
    atmosphere = Math.max(1, stars);
  }

  return {
    foodScore: String(food),
    serviceScore: String(service),
    atmosphereScore: String(atmosphere),
  };
}

function buildQuickSummaryItems(row: NegativeReviewReportRow): TemplateListItem[] {
  const text = row.comment.toLowerCase();
  const items: TemplateListItem[] = [];

  if (/otra vez|tercera|segunda|recurrente|siempre|otra vez|peor/.test(text)) {
    items.push({
      icon: "?",
      title: "PROBLEMA RECURRENTE Y EN DETERIORO",
      description:
        "El cliente indica que no es la primera incidencia y que la experiencia empeora en visitas sucesivas.",
    });
  } else {
    items.push({
      icon: "?",
      title: `INCIDENCIA: ${row.motive.toUpperCase()}`,
      description:
        row.comment.length > 160 ? `${row.comment.slice(0, 157)}…` : row.comment,
    });
  }

  if (/esper|minut|tard|cola|fila/.test(text)) {
    items.push({
      icon: "✎",
      title: "ESPERA EXCESIVA E INJUSTIFICADA",
      description:
        "El cliente menciona tiempos de espera prolongados respecto al servicio esperado en el local.",
    });
  } else {
    items.push({
      icon: "✎",
      title: "GESTIÓN DEL SERVICIO DEFICIENTE",
      description: `La reseña de ${row.stars} estrella${row.stars === 1 ? "" : "s"} señala fallos en la operativa del local.`,
    });
  }

  if (/mal|derret|frí|frio|calidad|estado|producto|helado|comida/.test(text)) {
    items.push({
      icon: "⚠",
      title: "PRODUCTO EN MAL ESTADO",
      description:
        "El comentario describe un producto entregado en condiciones inadecuadas o por debajo del estándar.",
    });
  } else {
    items.push({
      icon: "⚠",
      title: row.motive.toUpperCase(),
      description: `Motivo principal detectado en la reseña de ${row.author}.`,
    });
  }

  return items.slice(0, 3);
}

function buildImpactItems(row: NegativeReviewReportRow): TemplateListItem[] {
  const mediaLine =
    row.mediaBefore != null && row.mediaAfter != null
      ? `La media baja de ${row.mediaBefore.toFixed(1)} a ${row.mediaAfter.toFixed(1)}.`
      : row.impactText;

  return [
    {
      icon: "🛡",
      title: "DESCENSO DE LA MEDIA",
      description: mediaLine,
    },
    {
      icon: "●",
      title: "PÉRDIDA DE FIDELIZACIÓN",
      description:
        row.stars <= 2
          ? "El tono de la reseña sugiere que el cliente no volverá y puede desincentivar visitas futuras."
          : "La valoración baja reduce la probabilidad de repetición y recomendación del local.",
    },
    {
      icon: "📉",
      title: "DAÑO A LA IMAGEN DEL LOCAL",
      description:
        "Una reseña detallada y negativa influye en la percepción de futuros clientes en buscadores y mapas.",
    },
  ];
}

function buildFinalNote(row: NegativeReviewReportRow): string {
  const starLabel = row.stars === 1 ? "1 estrella" : `${row.stars} estrellas`;
  const mediaPart =
    row.mediaBefore != null && row.mediaAfter != null
      ? ` Provoca una bajada de la media global de ${row.mediaBefore.toFixed(1)} a ${row.mediaAfter.toFixed(1)}.`
      : " Provoca una bajada significativa de la media global.";

  return `El comentario tiene ${starLabel} y describe una experiencia muy negativa.${mediaPart} Representa un riesgo reputacional elevado para el restaurante.`;
}

export function mapRowToTemplateData(
  row: NegativeReviewReportRow,
  assetBaseUrl?: string
): NegativeReviewTemplateData {
  const visual = BRAND_VISUALS[row.brand];
  const { date, time } = formatReviewDateTime(row.dateIso);
  const subScores = deriveSubScores(row.stars, row.motive, row.comment);

  const previousRating =
    row.mediaBefore != null ? row.mediaBefore.toFixed(1) : "—";
  const currentRating =
    row.mediaAfter != null ? row.mediaAfter.toFixed(1) : "—";
  const ratingDrop =
    row.impact != null && row.impact < 0
      ? Math.abs(row.impact).toFixed(1)
      : row.mediaBefore != null && row.mediaAfter != null
        ? Math.max(0, row.mediaBefore - row.mediaAfter).toFixed(1)
        : "0.0";

  const showBkDecor = row.brand === "bk";

  return {
    brandName: resolveBrandDisplayName(row.brand, row.brandLabel),
    localName: resolveCityLabel(row),
    logoUrl: assetUrl(assetBaseUrl, visual.logo ?? "/brands/burger-king-transparent.png"),
    nexoLogoUrl: assetUrl(assetBaseUrl, NEXO_ORIGEN_LOGO_SRC),
    authorName: row.author,
    authorInitial: getAuthorInitial(row.author),
    reviewDate: date,
    reviewTime: time,
    stars: row.stars,
    comment: row.comment,
    ...subScores,
    previousRating,
    currentRating,
    ratingDrop,
    quickSummaryItems: buildQuickSummaryItems(row),
    impactItems: buildImpactItems(row),
    finalNote: buildFinalNote(row),
    decor: {
      beans: resolveDecorAssetUrl(assetBaseUrl, NEGATIVE_REVIEW_DECOR_ASSETS.beans),
      burger: resolveDecorAssetUrl(assetBaseUrl, NEGATIVE_REVIEW_DECOR_ASSETS.burger),
      cup: resolveDecorAssetUrl(assetBaseUrl, NEGATIVE_REVIEW_DECOR_ASSETS.cup),
      fries: resolveDecorAssetUrl(assetBaseUrl, NEGATIVE_REVIEW_DECOR_ASSETS.fries),
      sad: resolveDecorAssetUrl(assetBaseUrl, NEGATIVE_REVIEW_DECOR_ASSETS.sad),
      bkSticker: resolveDecorAssetUrl(assetBaseUrl, NEGATIVE_REVIEW_DECOR_ASSETS.bkSticker),
    },
    showBkDecor,
  };
}
