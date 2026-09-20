# Mapa de consumidores de reputación

## Propósito

Este documento registra dónde se consume o recalcula reputación en el código actual.

Objetivo:

> saber qué partes pueden migrarse a la lógica canónica sin cambiar resultados.

No implica que toda duplicación deba eliminarse de golpe.

---

# 1. Núcleo canónico actual

## `lib/reputation/rules.ts`

Fuente canónica inicial de:

- objetivo reputación: `4.4`;
- umbral vigilancia: `4.0`;
- positiva: 4–5;
- neutral: 3;
- negativa KPI: 1–2;
- estado operativo por media.

## `lib/reputation/dedupe.ts`

Fuente canónica inicial de:

- identidad por `review_id`;
- fallback de firma por contenido;
- selección de fila preferida.

## `lib/reputation/review-date.ts`

Fuente canónica inicial de:

- fecha de actividad de reseña editada.

## `lib/reputation/aggregation.ts`

Fuente canónica inicial de:

- fallback `resenas → kpi_diario → empty`;
- agregación ponderada de KPI diario;
- helper de media ponderada.

## Compatibilidad

`lib/review-metrics.ts` sigue reexportando APIs antiguas para evitar romper consumidores.

---

# 2. Consumidores que ya dependen del núcleo o de review-metrics

## Periodo / Supabase

- `lib/supabase/period-stats.ts`
- `lib/supabase/kpi-mappers.ts`
- `lib/supabase/resenas.server.ts`

Usan resultados o helpers centrales para construir KPIs del periodo.

## Ranking

- `lib/ranking/supabase-repository.ts`

Consume métricas de periodo y `sortRankingMetrics`.

## Inputs de restaurante

- `lib/restaurants/reputation-inputs.ts`

Usa `classifyMediaStatus` para resolver el estado cuando no existe métrica de periodo.

---

# 3. Cálculos repetidos que son candidatos de migración segura

Estos bloques calculan matemáticas que ya tienen una semántica clara y pueden ir migrándose al núcleo sin cambiar producto.

## Media ponderada de red

Aparece en:

- `lib/services/dashboard.server.ts`;
- `lib/services/dashboard.ts`;
- `lib/restaurants/metrics.ts`;
- `lib/reports/network-summary/build.ts`;
- `lib/reports/weekly/build-from-kpi.ts`.

Todos usan esencialmente:

`Σ(media × volumen) / Σ(volumen)`

Dirección:

usar un helper canónico de agregación.

## Porcentajes positivas / negativas

Se recalculan en algunos consumidores como:

`conteo / total × 100`

Ejemplos:

- dashboard;
- network summary;
- weekly reports.

Dirección:

cuando consumen el mismo conjunto de datos, reutilizar el resultado canónico del periodo.

## Estados

Existían copias del `4.4` y `4.0`.

En este hardening:

- `REPUTATION_TARGET` ya se centraliza en `lib/reputation/rules.ts`;
- `REPUTATION_WATCH_THRESHOLD` ya se centraliza en `lib/reputation/rules.ts`;
- módulos antiguos pueden mantener reexports de compatibilidad.

---

# 4. Consumidores de Web / Dashboard

## `lib/dashboard-data.ts`

Consume `review-metrics`, pero mantiene algunas decisiones locales:

- fallback visual `En riesgo/watch` cuando no existe periodo;
- recomposición de porcentajes si existen otros KPI de dashboard.

Esto debe revisarse antes de migrar `no_data`.

## `lib/services/dashboard.server.ts`

Recalcula:

- media ponderada de red;
- conteos por estado;
- total de negativas.

## `lib/services/dashboard.ts`

Repite una versión equivalente de esos cálculos.

Esto es una duplicación clara que conviene consolidar.

## `lib/supabase/dashboard-data.ts`

Usa datos centrales, pero además:

- trata reseñas de hasta 3 estrellas como elementos problemáticos en ciertos bloques;
- crea destacados y rankings locales.

No asumir que ese filtro representa el KPI oficial de “negativas”.

---

# 5. Restaurantes / Prevent

## `lib/restaurants/metrics.ts`

Calcula:

- resumen de estados;
- media ponderada de red.

El target ya se reexporta desde la fuente canónica.

## `lib/restaurants/reputation-math.ts`

Contiene fórmulas específicas de protección/objetivo.

No son simples KPIs de reputación y deben tratarse como subdominio Prevent.

## `lib/restaurants/reputation-metrics.ts`

Usa la media/objetivo, pero define `detractors` como estrellas `<= 3`.

Ese concepto no debe llamarse automáticamente “negativas KPI”.

## `lib/prevent/calculate.ts`

Contiene:

- positivas necesarias;
- tolerancia de negativas;
- protección reputacional;
- simulación futura.

Son reglas de Prevent, no deben mezclarse con el cálculo base de media.

El target ya llega indirectamente desde la fuente canónica.

---

# 6. Informes

## `lib/informes/resolve-informe-estado.ts`

Los umbrales ya consumen:

- `REPUTATION_TARGET`;
- `REPUTATION_WATCH_THRESHOLD`.

Las etiquetas visuales pueden seguir siendo propias del informe.

## `lib/informes/informe-kpi-utils.ts`

Actualmente define explícitamente:

> “Negativas: reseñas de 1, 2 o 3 estrellas”.

Esto contradice la definición KPI oficial si se interpreta literalmente como “negativa”.

Antes de modificarlo hay que decidir si la métrica real es:

- negativa KPI = 1–2;
- o reseña problemática/no positiva = 1–3.

## `lib/reports/network-summary/build.ts`

Recalcula:

- media ponderada;
- porcentajes;
- estados visuales.

Los umbrales ya se han conectado a la fuente canónica.

Para motivos negativos filtra actualmente estrellas `<= 3`.

## `lib/reports/weekly/build-from-kpi.ts`

Recalcula:

- media ponderada;
- porcentaje negativo;
- locales bajo objetivo.

Los motivos negativos pasan por `getTopReasons(... negativesOnly: true)`, cuyo comportamiento heredado incluye 3 estrellas.

## `lib/reports/negative-reviews/build-rows.ts`

El “informe de negativas” incluye actualmente reseñas `<= 3`.

Es una decisión funcional existente y no debe cambiarse sin revisar la salida que reciben los clientes.

---

# 7. Alertas

## `lib/alerts/build-from-resenas.ts`

Incluye reseñas `<= 3`.

Después diferencia:

- 1–2 → `critico`;
- 3 → `seguimiento`.

Semánticamente esto se parece más a:

- alerta crítica;
- alerta de seguimiento;

que a un único KPI de “reseñas negativas”.

Esta distinción es útil y no debe perderse.

---

# 8. WhatsApp

## `app/api/webhooks/new-resena-whatsapp/route.ts`

Actualmente:

- ignora reseñas >3;
- envía 1–3;
- el comentario del código lo denomina “reseñas negativas”.

Esto no coincide con la definición KPI oficial 1–2.

Es una discrepancia conocida de producto, no un error que deba corregirse automáticamente.

Antes de cambiarla decidir:

1. ¿WhatsApp debe avisar solo 1–2?
2. ¿O debe avisar 1–3 pero llamar a 3★ “seguimiento”?
3. ¿Debe ser configurable por cliente?

---

# 9. Resumen de semántica actual

## Negativa KPI

`1–2 estrellas`

Usada para:

- KPIs de periodo;
- conteos oficiales de negativas.

## Neutral

`3 estrellas`

Definición oficial del KPI.

## Problemática / seguimiento heredado

`1–3 estrellas`

Aparece actualmente en:

- motivos;
- informes de negativas;
- alertas;
- WhatsApp;
- algunos destacados de dashboard;
- detractors.

Problema principal:

muchos nombres llaman “negativa” a algo que realmente significa “no positiva / problemática / seguimiento”.

---

# 10. Orden de migración recomendado

## Paso A — seguro

Centralizar sin cambiar resultados:

- constantes;
- medias ponderadas;
- porcentajes;
- helpers de estado;
- deduplicación;
- fechas;
- fuentes/fallback.

## Paso B — paridad

Hacer tests donde el mismo periodo se procese por:

- dashboard;
- informe;
- ranking;
- alertas.

Comprobar qué diferencias son reales y cuáles son solo presentación.

## Paso C — semántica 3 estrellas

No cambiar hasta definir vocabulario:

- `negative` = 1–2;
- `neutral` = 3;
- posible `needs_attention/problematic` = 1–3.

Después migrar nombres y consumidores gradualmente.

## Paso D — WhatsApp

Una vez definida la semántica:

- consumir la regla central;
- separar severidad de alerta;
- hacer destinatarios/configuración persistentes.

---

# 11. Regla práctica

Antes de sustituir un cálculo local:

1. identificar qué pregunta responde;
2. comprobar si usa exactamente los mismos datos;
3. comparar resultado actual vs canónico;
4. migrar un consumidor;
5. validar;
6. continuar con el siguiente.

No eliminar una fórmula solo porque “se parece” a otra si su denominador o semántica son distintos.
