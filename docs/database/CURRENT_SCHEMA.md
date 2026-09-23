# Nexo Origen — Esquema actual

## Propósito

Este documento describe **lo que el repositorio actual espera de Supabase**.

No es el modelo futuro de Nexo. Para eso existe `DATA_MODEL.md`.

No añadir aquí tablas futuras como si ya existieran en producción.

---

# 0. Mapa vivo de la base de datos

Cada tabla, vista, función y columna clave de Supabase lleva un comentario con formato único:

```
[AREA|estado] Qué es. ORIGEN: quién/qué la rellena. USO: quién la lee.
```

Tres vistas de solo lectura (service role / panel de Supabase) se generan leyendo esos comentarios, así que **no pueden quedar desactualizadas**:

| Vista | Responde a |
|---|---|
| `nexo_mapa_sistema` | ¿Qué existe y de dónde sale? (área, estado, origen, uso) |
| `nexo_mapa_conexiones` | ¿Cómo se unen las tablas y qué pasa al borrar? |
| `nexo_mapa_automatismos` | ¿Qué ejecuta la base de datos sola (triggers)? |

Un objeto sin comentario aparece como `sin_documentar`. **Regla: toda migración que cree un objeto debe comentarlo con este formato.**

| Área | Contenido | Estado |
|---|---|---|
| `CORE` | `empresas`, `marcas`, `restaurantes` | producción |
| `ACCESS` | `perfiles`, `usuario_marcas`, `usuario_restaurantes` | producción |
| `REPUTATION` | `resenas`, `analisis_ia`, `resena_motivos`, `resenas_historial`, `resenas_traducciones` + funciones `nexo_reputation_*` y triggers de `resenas` | producción |
| `OPERACIONES` | `canales`, `metricas_catalogo`, `restaurante_metricas`, `objetivos` (ver §15) | preparado (vacío) |
| `BOT` | `nexo_bot_*` (accesos, sesiones, conversaciones, alertas, resúmenes) | producción |
| `INTEGRATIONS` | `restaurante_integraciones`, `restaurante_fuente_aliases`, `nexo_make_daily_report_payload` | producción |
| `INTERNAL` | `review_identity_shadow_events`, `nexo_metric_validation_events`, vistas `nexo_mapa_*` | shadow / soporte |
| `LEGACY` | `kpi_diario/semanal/mensual/semana_actual`, `alertas_enviadas`, vistas `kpi_*`, `dashboard_*`, `motivos_*`, `resumen_restaurantes`, `get_kpis_periodo` | compatibilidad / retirar |

Estados: `produccion`, `preparado` (creado, sin datos aún), `shadow` (solo pruebas), `compatibilidad` (puede tener lectores), `retirar` (candidato a borrar tras confirmar).

SQL versionado de esta organización: `supabase/restore_resenas_traducciones.sql`, `supabase/operational_data_foundation.sql`, `supabase/database_catalog_map.sql`.

---

# 1. Jerarquía actual

La jerarquía empresarial efectiva es:

**empresa → marca → restaurante**

Actualmente existe una peculiaridad importante:

- `restaurantes` tiene `empresa_id`;
- `restaurantes` tiene `marca_id`;
- `marcas` no tiene actualmente una relación directa `empresa_id` según el código del repositorio;
- empresa ↔ marca se deriva a través de los restaurantes.

Por tanto, no asumir que existe `marcas.empresa_id`.

---

# 2. Objetos Supabase utilizados por la aplicación

Definidos en `lib/supabase/tables.ts`.

## Tablas

- `empresas`
- `marcas`
- `restaurantes`
- `resenas`
- `kpi_diario`
- `dashboard_kpis`
- `perfiles`
- `analisis_ia`
- `resena_motivos`
- `usuario_marcas`
- `usuario_restaurantes`

## Vistas

- `kpi_restaurantes`

## Referencias directas adicionales

El código actual también referencia directamente:

- `resenas_traducciones` — caché de traducciones DeepL (`lib/translate/resena-translations.ts`). Restaurada en producción; RLS activo sin políticas (solo service role).
- `whatsapp_alertas_enviadas` — la usa `app/api/webhooks/new-resena-whatsapp/route.ts`, pero **la tabla ya no existe en producción**. Las alertas vigentes van por el Asistente Nexo (`nexo_bot_alertas_pendientes` / `nexo_bot_alertas_envios`). La ruta está inactiva y debe retirarse o migrarse antes de reactivarla.

Estas tablas no están centralizadas en `lib/supabase/tables.ts`, pero son dependencias reales del código.

---

# 3. empresas

El código actual utiliza al menos:

- `id`
- `nombre`

Los usuarios con rol `empresa_admin` se limitan por `perfiles.empresa_id` y por los restaurantes pertenecientes a esa empresa.

No documentar más columnas como obligatorias hasta verificarlas en el esquema real.

---

# 4. marcas

El código actual utiliza:

- `id`
- `nombre`

Actualmente no se debe asumir que `marcas` contiene `empresa_id`.

La pertenencia de una marca a una empresa se deriva a través de `restaurantes`.

---

# 5. restaurantes

El código actual utiliza o depende de:

- `id`
- `nombre`
- `ciudad`
- `marca_id`
- `empresa_id`
- `media_google`
- `total_resenas_google`

`media_google` y `total_resenas_google` representan el snapshot público de Google y son alimentados por un proceso externo.

La aplicación actual los lee; no debe asumirse que el dashboard es quien los actualiza.

---

# 6. resenas

Campos observados por el código actual:

- `id`
- `review_id`
- `restaurante_id`
- `estrellas`
- `comentario`
- `autor`
- `fecha_resena`
- `created_at`
- `editada`
- `fecha_ultima_edicion`
- información textual de restaurante / marca / dirección cuando existe.

## Identidad

El código prioriza `review_id` como identificador externo de la reseña.

Si falta, existen mecanismos de deduplicación por contenido.

## Fecha de actividad

Actualmente una reseña editada se asigna al periodo de su última edición cuando `editada = true` y existe `fecha_ultima_edicion`.

La fecha original se conserva para mostrarla.

Esta regla evita contar una misma fila en dos periodos, pero **no equivale a conservar un histórico completo de todas las versiones de una reseña**.

Ese problema se trata en `DATA_MODEL.md`.

---

# 7. analisis_ia

La unión actual correcta es:

`analisis_ia.review_id = resenas.review_id`

No utilizar `resenas.id` como sustituto sin revisar el flujo.

Campos observados:

- `review_id`
- `resumen`
- `motivo`
- `impacto`
- `recomendacion`
- `riesgo`
- `empleado_mencionado`
- `sentimiento`
- `created_at`

Los análisis son interpretación. No deben convertirse en fuente de verdad de cálculos deterministas.

---

# 8. kpi_diario

Granularidad actual:

**1 fila por restaurante y día**

Campos utilizados:

- `restaurante_id`
- `fecha`
- `total_resenas`
- `media`
- `negativas`
- `positivas`

Las medias de varios días/restaurantes deben agregarse de forma ponderada por volumen de reseñas.

---

# 9. kpi_restaurantes

Es una **vista de lectura**, no una tabla. Estado: `LEGACY|compatibilidad`. La web ya no la lee: el catálogo sale de `nexo_reputation_restaurant_catalog` y las métricas de `nexo_reputation_period_metrics`.

Campos que exponía a la aplicación:

- `restaurante_id`
- `restaurante`
- `ciudad`
- `marca`
- `total_resenas`
- `media_total`
- `resenas_negativas`
- `resenas_positivas`
- `ultima_resena`
- `estado`

Después, el código puede enriquecer estas filas con:

- `media_google`
- `total_resenas_google`

procedentes de `restaurantes`.

---

# 10. perfiles y permisos

`perfiles.id = auth.users.id`

Campos documentados en el repositorio:

- `id`
- `nombre`
- `email`
- `rol`
- `empresa_id`
- `created_at`

Roles:

- `super_admin`
- `empresa_admin`
- `marca_admin`
- `restaurante_user`

Asignaciones adicionales:

- `usuario_marcas.user_id → marca_id`
- `usuario_restaurantes.user_id → restaurante_id`

---

# 11. Seguridad actual

Una parte relevante del aislamiento multiempresa depende actualmente de la capa de aplicación:

- `lib/auth/scopes.ts`
- `lib/auth/data-scope.ts`

Varias tablas tienen políticas SELECT permisivas en los SQL actuales.

Por tanto:

> el filtrado de scope es hoy parte de la frontera de seguridad y no puede eliminarse o saltarse casualmente.

En el futuro se puede reforzar RLS, pero debe hacerse como migración controlada.

---

# 12. Fuentes externas

Las reseñas y los snapshots públicos de Google son alimentados por procesos externos que no forman parte actualmente de este repositorio.

La aplicación consume esos datos.

Esto significa que el esquema actual no representa todavía todo el pipeline de ingesta de Nexo.

---

# 13. Limitaciones conocidas del esquema actual

- No existe todavía un modelo común para todas las integraciones externas.
- Las reseñas editadas no tienen un histórico completo de versiones persistido por la aplicación.
- La relación empresa ↔ marca se deriva indirectamente.
- Los KPIs actuales están muy orientados a reputación.
- La base para ventas, tiempos, personal y costes existe (área `OPERACIONES`, §15) pero está vacía: aún no hay ninguna fuente conectada.
- La seguridad en base de datos puede reforzarse: 9 vistas legacy son `SECURITY DEFINER` y varias tablas de reputación tienen lectura `anon` permisiva (ver advisors de Supabase).
- `nexo_reputation_period_motives` (web) y `nexo_reputation_motives_period` (bot) calculan la misma distribución con reglas de fecha/deduplicación distintas y pueden diferir en unas pocas reseñas.
- `nexo_bot_memoria_limpiar` no está programada en la base (no hay `pg_cron`); depende de un flujo externo.

Estas limitaciones no deben corregirse todas a la vez. Se migrarán por fases.


---

# 14. Cálculo canónico de reputación

Supabase almacena los hechos de reputación **y calcula las métricas numéricas oficiales de periodo**.

Función SQL canónica:

- `public.nexo_reputation_period_metrics(p_start, p_end, p_restaurant_ids)`

Adaptadores del repositorio:

- `lib/supabase/reputation-metrics.server.ts`
- `lib/reputation/canonical-metrics.server.ts`

Las interfaces Web, informes y resúmenes diarios consumen el resultado de esa función. No deben redefinir medias, porcentajes o estados.

Durante la migración, `nexo_metric_validation_events` registra discrepancias detectadas entre el resultado SQL canónico y el cálculo TypeScript anterior ejecutado en modo sombra.

## Informes PNG de red

Las imágenes de informe (`lib/reports/network-summary`) se calculan **enteras en Supabase** con `public.nexo_network_summary_payload(p_start, p_end, p_restaurant_ids, p_negative_max_stars)`: totales, media ponderada, objetivo de cada marca (`marcas.objetivo_media`), estado de cada local, motivo principal y reparto de motivos negativos. La aplicación solo elige qué restaurantes componen cada informe (`brand-groups.ts`) y da formato al resultado (`build.ts`); no recalcula nada y no tiene plan B: si la función falla, el informe falla.

Reglas: positivas 4-5★, neutras 3★, negativas 1-2★; el reparto de motivos usa hasta `p_negative_max_stars` estrellas (3 por defecto; 2 en Grupo Hámbar); estado = sobre objetivo / vigilancia (≥ 4,0) / fuera. SQL: `supabase/network_summary_payload.sql`.

La vista `kpi_restaurantes` se mantiene como catálogo/snapshot histórico compatible, pero no es la autoridad para la media de un periodo seleccionado.

`dashboard_kpis` puede conservar datos legacy/auxiliares, pero no debe sobrescribir una métrica canónica.

---

# 15. Datos operativos por restaurante (área OPERACIONES)

Creado el 2026-09-23 (`supabase/operational_data_foundation.sql`). **Estructura lista, sin datos**: ninguna fuente (StoreAce, TPV, delivery) está conectada todavía.

Cuatro conceptos, cuatro tablas (hecho, vocabulario, configuración):

| Tabla | Naturaleza | Para qué |
|---|---|---|
| `canales` | vocabulario | `total`, `sala`, `auto`, `delivery`, `takeaway` |
| `metricas_catalogo` | vocabulario | qué se mide, unidad, cómo se agrega, si mejor es mayor o menor. Inicial: `tiempo_servicio`, `ventas_netas`, `tickets` |
| `restaurante_metricas` | **hechos** | un valor de una métrica, de un restaurante, en un canal y un periodo |
| `objetivos` | configuración | objetivo con vigencia por empresa, marca o restaurante |

Cómo entra un dato nuevo (p. ej. "tiempo Auto de 3:07 en el Burger King 12, de 13:00 a 14:00"):

1. La fuente se registra en `restaurante_integraciones` (`provider`, `external_ref`). Un proveedor nuevo requiere ampliar el `CHECK` de `provider`.
2. La ingesta (servidor, service role) hace *upsert* en `restaurante_metricas`: `metrica_clave='tiempo_servicio'`, `canal_clave='auto'`, `valor=187` (segundos), `muestras=n`, `fuente='storeace'`. La clave única `(restaurante_id, metrica, canal, periodo_inicio, periodo_fin, fuente)` hace la ingesta idempotente.
3. Domain calcula KPIs/comparativas y el Brain los interpreta. La UI solo formatea (`mm:ss`).

Una métrica nueva = una fila en `metricas_catalogo` (sin DDL). Solo si el volumen lo justifica (p. ej. datos por minuto) habrá que particionar o crear una tabla dedicada.

Reglas:

- **La reputación no se guarda aquí.** Su única fuente es `resenas` → `nexo_canonical_reviews`.
- Tiempos en segundos; dinero como importe + `moneda` (ISO-4217); nunca solo porcentajes: guardar numerador y denominador.
- `restaurante_metricas.restaurante_id` es `ON DELETE RESTRICT`: no se pierde histórico operativo al borrar un local.
- El aislamiento por tenant se resuelve por `restaurante_id → restaurantes.empresa_id`. RLS activo sin políticas: solo accede el servidor.
- `restaurantes.zona_horaria` (IANA, por defecto `Europe/Madrid`) define el día de negocio de cada local. El código actual todavía asume Madrid.
- El objetivo de rating sigue en `marcas.objetivo_media`; no se migra a `objetivos` hasta que la capa de configuración esté lista.
