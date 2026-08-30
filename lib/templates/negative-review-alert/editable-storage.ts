/**
 * Persistencia (localStorage, no sessionStorage — para que sobreviva a
 * cerrar la pestaña del editor) de los ajustes manuales que se hacen en
 * /preview/negative-review-alert (diseño "Editable") para una reseña
 * concreta: posiciones, tamaños, tamaños de letra y fecha/hora editadas. Así,
 * si el usuario guarda, sale del editor y vuelve a abrirlo para la misma
 * reseña, ve exactamente los mismos ajustes en vez de partir de cero.
 */

export type SavedReviewEdit = {
  offsets: Record<string, { x: number; y: number }>;
  sizes: Record<string, { width: number; height: number }>;
  fontDeltas: Record<string, number>;
  editedDate: string | null;
  editedTime: string | null;
};

function storageKey(reviewId: string): string {
  return `nra-saved-edit:${reviewId}`;
}

export function loadSavedReviewEdit(reviewId: string): SavedReviewEdit | null {
  try {
    const raw = window.localStorage.getItem(storageKey(reviewId));
    if (!raw) return null;
    return JSON.parse(raw) as SavedReviewEdit;
  } catch {
    return null;
  }
}

export function saveReviewEdit(reviewId: string, edit: SavedReviewEdit): void {
  try {
    window.localStorage.setItem(storageKey(reviewId), JSON.stringify(edit));
  } catch {
    // localStorage no disponible (modo privado, cuota llena...) — se ignora,
    // el editor sigue funcionando, solo que sin persistencia.
  }
}

export function clearSavedReviewEdit(reviewId: string): void {
  try {
    window.localStorage.removeItem(storageKey(reviewId));
  } catch {
    // ignorar
  }
}
