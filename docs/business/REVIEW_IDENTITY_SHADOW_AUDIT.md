# Auditoría sombra — identidad de reseñas Google

Fecha de análisis: 2026-09-21.

Esta auditoría no modifica producción. Analiza el histórico actual de `resenas` para validar si
`provider + place_id + reviewer_id` puede utilizarse automáticamente como identidad de una reseña lógica.

## Muestra

En el momento de la consulta:

- 73 pares restaurante + reviewer tenían más de un `review_id`;
- esos pares contenían 170 filas;
- existen 97 transiciones entre IDs dentro de esos pares.

La cifra puede cambiar conforme entren nuevas reseñas.

## Resultado

No es seguro fusionar automáticamente todas las filas que compartan cuenta + restaurante.

Entre las 97 transiciones observadas:

- 7 tienen exactamente el mismo timestamp: duplicados/importaciones con confianza muy alta;
- 4 son repeticiones sin comentario en menos de 2 horas: duplicado probable;
- 5 mantienen contenido no vacío idéntico pero cambian de review ID: mismo contenido con nuevo ID, candidato fuerte;
- 6 cambian estrellas: candidato fuerte a cambio/republicación que necesita conservar versiones;
- 75 son ambiguas: la misma cuenta puede volver a publicar en días/semanas posteriores y no podemos demostrar solo con estos campos si fue edición, borrado + nueva publicación o una observación histórica defectuosa.

Hay ejemplos reales separados por semanas o meses, por lo que la regla "una cuenta + un restaurante = una única reseña para siempre" sería demasiado agresiva.

## Decisión de diseño

`provider + place_id + reviewer_id` se utiliza como **clave de candidato**, no como prueba suficiente de identidad.

Orden de resolución recomendado:

1. `provider_review_id` conocido → misma reseña lógica.
2. Nuevo provider ID + evidencia fuerte de continuidad → vincular como alias/versión.
3. Nuevo provider ID + evidencia ambigua → no fusionar automáticamente; registrar candidato de enlace.
4. Una reconciliación posterior puede confirmar el enlace con señales adicionales.

Señales de continuidad:

- mismo timestamp de publicación;
- contenido normalizado idéntico;
- información explícita de edición/update del proveedor;
- proximidad temporal combinada con contenido/estrellas;
- historial previo de aliases;
- futuras señales de Google Business/API cuando estén disponibles.

Nunca fusionar únicamente porque coincidan nombre visible del autor o porque el reviewer ID coincida.

## Implicación para periodos cerrados

Esta incertidumbre no cambia la regla principal:

- una semana/mes cerrado permanece inmutable;
- una edición posterior se registra como evento del nuevo periodo;
- una edición no cuenta como nueva reseña;
- si no podemos demostrar que un nuevo provider ID es una edición, no reescribimos el histórico automáticamente.

Esto favorece trazabilidad frente a una deduplicación agresiva que podría borrar hechos reales.

## Siguiente implementación

Antes de producción, el modelo V2 debe incorporar un estado de reconciliación para los IDs nuevos:

- `confirmed`;
- `candidate`;
- `rejected`;

junto con razón/confianza/evidencia.

El flujo sombra debe registrar decisiones sin alterar `resenas`, informes, alertas ni Make productivo.
