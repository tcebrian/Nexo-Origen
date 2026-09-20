# Nexo Origen — Dominio de reputación

## Propósito

Reputación es el primer dominio maduro de Nexo y debe servir como referencia para ventas, tiempos y personal.

Este documento describe tanto las **reglas actuales canónicas** como las discrepancias heredadas que todavía deben migrarse con cuidado.

Las reglas generales están en `BUSINESS_RULES.md`.

El mapa de consumidores y duplicaciones está en `REPUTATION_CONSUMERS.md`.

---

# 1. Fuentes actuales

La aplicación trabaja principalmente con:

- `resenas`;
- `analisis_ia`;
- `resena_motivos`;
- `kpi_diario`;
- vista `kpi_restaurantes`;
- metadatos de restaurantes y marcas.

`restaurantes.media_google` y `restaurantes.total_resenas_google` son snapshots públicos de Google alimentados externamente.

No confundir:

- media de reseñas del periodo analizado;
- media pública actual de Google.

Son métricas distintas.

---

# 2. Objetivo actual

Objetivo general actual:

`REPUTATION_TARGET = 4.4`

La fuente canónica inicial vive ahora en `lib/reputation/rules.ts`.

`lib/review-metrics.ts` mantiene un re-export de compatibilidad para no romper consumidores existentes.

Hasta introducir objetivos configurables/versionados, no crear otra copia del 4,4 en nuevos módulos.

---

# 3. Clasificación por estrellas

Para KPIs de reputación:

- **positiva:** 4–5 estrellas;
- **neutral:** 3 estrellas;
- **negativa:** 1–2 estrellas.

Por tanto:

`positivas + neutrales + negativas = total`

La reseña de 3 estrellas no es negativa en los KPIs oficiales.

---

# 4. Conteos

Para un periodo:

- `totalResenas` = número de reseñas únicas válidas;
- `resenasPositivas` = estrellas >= 4;
- `resenasNegativas` = estrellas <= 2;
- neutrales = estrellas = 3.

También se conservan conteos por:

- 1 estrella;
- 2 estrellas;
- 3 estrellas;
- 4 estrellas;
- 5 estrellas.

---

# 5. Media de un restaurante

Para reseñas individuales:

`media = suma de estrellas / número de reseñas`

No utilizar la media pública de Google para calcular la media de un periodo interno.

Si no hay reseñas del periodo, la media del periodo no debería interpretarse semánticamente como un rendimiento real de 0.

---

# 6. Media de red / marca

La media de varios restaurantes debe ser ponderada por volumen.

`media_red = Σ(media_restaurante × nº_reseñas_restaurante) / Σ(nº_reseñas)`

Equivale a calcular la media sobre todas las reseñas individuales.

No usar una media simple de medias de restaurantes.

---

# 7. Porcentajes

Actualmente:

`positivePct = positivas / total × 100`

`negativePct = negativas / total × 100`

Las reseñas neutrales permanecen dentro del denominador total.

Por ello:

`positivePct + negativePct`

puede ser menor que 100%.

El código actual redondea estos porcentajes de red a una decimal.

---

# 8. Estado respecto al objetivo

Regla actual en `classifyMediaStatus`:

## Óptimo / on_target

`media >= 4.4`

## En riesgo / watch

`4.0 <= media < 4.4`

## Crítico / critical

`media < 4.0`

Estas fronteras deben ser las mismas en Web, informes, alertas y cualquier otra interfaz.

---

# 9. Caso sin reseñas

Comportamiento técnico actual:

si un restaurante tiene 0 reseñas en el periodo, `classifyMediaStatus` devuelve:

- `statusLabel = "En riesgo"`
- `operationalStatus = "watch"`

Esto es comportamiento existente, no necesariamente la semántica ideal.

Dirección futura:

distinguir explícitamente `no_data / sin reseñas` de un restaurante realmente “En riesgo”.

No cambiarlo hasta comparar los consumidores actuales y evitar regresiones visuales/informes.

---

# 10. Deduplicación

La implementación actual hace dos pasos.

## Paso 1

Deduplica por `review_id` cuando existe.

## Paso 2

Vuelve a deduplicar por firma de contenido:

- restaurante;
- fecha;
- autor;
- estrellas;
- comentario.

Cuando hay duplicados, el código intenta conservar la fila preferida/más reciente según las reglas actuales.

Antes de tocar deduplicación revisar `lib/review-metrics.ts`.

---

# 11. Reseñas editadas y periodo

Actualmente una reseña pertenece a un único periodo según su **fecha de actividad**.

Si:

- `editada = true`;
- existe `fecha_ultima_edicion`;

se utiliza la fecha de última edición.

En caso contrario se utiliza:

- `fecha_resena`;
- o `created_at` como fallback.

Esto evita contar una misma fila en el periodo original y en el periodo de edición simultáneamente.

Limitación:

no preserva por sí solo todas las versiones históricas de la reseña.

El modelo futuro de versionado está descrito en `docs/database/DATA_MODEL.md`.

---

# 12. Prioridad de fuente para métricas de periodo

En `buildPeriodMetrics` la prioridad actual es:

1. reseñas individuales deduplicadas, si existen;
2. `kpi_diario`, si no hay reseñas;
3. vacío.

La fuente utilizada se expone internamente como:

- `resenas`;
- `kpi_diario`;
- `empty`.

No crear un tercer cálculo paralelo sin definir cómo encaja con esta prioridad.

---

# 13. Catálogo de restaurantes

Las métricas se agrupan por `restaurante_id`.

Los nombres, ciudades y marcas deben considerarse metadatos de catálogo, no claves fiables de identidad cuando existe ID.

Evitar agrupar por texto si existe `restaurante_id`.

---

# 14. Motivos

Motivos principales actuales:

- Tiempo de espera;
- Pedido incorrecto;
- Atención al cliente;
- Calidad producto;
- Limpieza;
- Falta de producto;
- Precio;
- Ambiente/local;
- Empleado mencionado;
- Sin comentario;
- Otros.

La clasificación combina:

- comentario original;
- análisis IA existente;
- reglas/heurísticas.

El comentario del cliente debe tener más peso que una etiqueta IA genérica contradictoria.

---

# 15. Motivo principal y secundarios

Una reseña puede contener varios problemas.

Nexo puede detectar:

- motivo principal;
- motivos secundarios.

No perder esta distinción.

Para rankings de problemas hay que indicar si se cuentan:

- reseñas;
- motivos;
- restaurantes afectados.

Son denominadores diferentes.

---

# 16. Discrepancia actual: 3 estrellas en análisis de problemas

Los KPIs oficiales definen negativa como 1–2 estrellas.

Sin embargo, algunas rutas heredadas de análisis de motivos utilizan hasta 3 estrellas al aplicar filtros de “problemas/negativas”.

Esto es deuda técnica conocida.

Regla de migración:

- no redefinir el KPI oficial;
- identificar cada consumidor que incluye 3 estrellas;
- decidir si conceptualmente habla de “negativas” o de “no positivas/problemáticas”;
- renombrar o corregir con tests de paridad.

No cambiarlo de forma global sin esa revisión.

---

# 17. IA

La IA puede aportar:

- resumen;
- sentimiento;
- motivo;
- impacto;
- riesgo;
- empleado mencionado;
- recomendación.

La IA no debe decidir:

- media;
- conteos;
- porcentajes;
- deduplicación;
- estado 4,4 / 4,0;
- permisos.

---

# 18. Volumen y confianza

Una media con pocas reseñas es matemáticamente válida pero menos representativa.

Futuro:

acompañar resultados de reputación con volumen/cobertura cuando sea relevante.

No alterar la media por bajo volumen.

En su lugar, mostrar la advertencia como información adicional.

---

# 19. Comparación de periodos

Al comparar reputación, distinguir:

## Media

Mostrar diferencia en puntos.

Ejemplo:

4,18 → 4,42 = +0,24 puntos.

## Volumen

Mostrar diferencia absoluta y, si existe base válida, variación porcentual.

## Negativas

Comparar conteo y/o tasa, indicando cuál se usa.

No afirmar que una mejora de media es estadísticamente significativa solo porque haya subido.

---

# 20. Media pública Google vs media Nexo

## Media pública Google

Snapshot actual visible en Google.

Puede incorporar histórico fuera del periodo seleccionado.

## Media Nexo del periodo

Calculada con las reseñas que Nexo asigna al periodo.

No deben etiquetarse como si fueran la misma métrica.

---

# 21. Semáforo visual

Convención actual de negocio:

- verde: >= 4,4;
- amarillo: 4,0–4,39...;
- rojo: < 4,0.

El color es presentación.

La fuente de verdad debe ser el estado interno calculado, no el color CSS.

---

# 22. Tests mínimos del dominio

Comando inicial de validación:

`npm run test:reputation`

El primer lote ya congela objetivo, estados básicos, polaridad por estrellas y el comportamiento heredado sin reseñas.

Antes de considerar reputación consolidada deben existir casos para:

- 4,4 exacto → objetivo;
- 4,0 exacto → watch;
- 3,99 → critical;
- 3 estrellas → neutral;
- media ponderada de varios restaurantes;
- periodo sin reseñas;
- review_id duplicado;
- duplicado por contenido;
- reseña editada entre periodos;
- fallback a `kpi_diario`;
- porcentajes con neutrales;
- misma métrica consumida por más de una interfaz.

---

# 23. Fuente canónica futura

Objetivo de la Fase 1:

```
datos de reputación
      ↓
dominio de reputación
      ↓
resultado canónico
   ┌──┼───────────┐
   ↓  ↓           ↓
 Web  Informes  WhatsApp/Alertas
```

No:

```
Web calcula A
Informe calcula B
WhatsApp calcula C
```

Una vez conseguido esto, reputación será el patrón para los siguientes dominios.
