# Nexo Origen — Esquema actual

## Propósito

Este documento describe **lo que el repositorio actual espera de Supabase**.

No es el modelo futuro de Nexo. Para eso existe `DATA_MODEL.md`.

No añadir aquí tablas futuras como si ya existieran en producción.

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

## Datos base de reputación

- `empresas`
- `marcas`
- `restaurantes`
- `resenas`
- `analisis_ia`
- `resena_motivos`

## Autorización y usuarios

- `perfiles`
- `usuario_marcas`
- `usuario_restaurantes`

## Cálculo canónico de reputación

- `public.nexo_reputation_period_metrics(...)`
- `public.nexo_review_rating_impacts(...)`
- `public.nexo_reputation_period_motives(...)`

La aplicación no debe consultar como fuente de reputación las antiguas tablas/vistas `kpi_diario`, `kpi_semanal`, `kpi_mensual`, `kpi_semana_actual`, `kpi_restaurantes`, `kpi_marcas`, `dashboard_kpis` o `dashboard_restaurantes`.

Los nombres TypeScript históricos como `KpiRestaurantRow` pueden mantenerse temporalmente como DTO de compatibilidad, pero no implican que exista o se consulte una vista KPI en Supabase.

## Referencias directas adicionales

El sistema contiene además tablas operativas de alertas, bots, integraciones y auditoría. No forman parte del cálculo matemático de reputación.

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

# 8. Capa canónica de reputación

Las métricas oficiales no se persisten en múltiples tablas KPI precalculadas.

Se derivan bajo demanda en PostgreSQL a partir de los hechos base:

- `resenas` → puntuación, volumen, distribución por estrellas y estados;
- `resena_motivos` → distribución de motivos;
- `restaurantes + marcas + empresas` → catálogo y alcance.

Funciones:

- `nexo_reputation_period_metrics(...)`
- `nexo_review_rating_impacts(...)`
- `nexo_reputation_period_motives(...)`

La aplicación puede conservar campos de compatibilidad vacíos en sus contratos durante la transición, pero no debe leer tablas KPI legacy.

---

# 9. Objetos legacy de reputación

La migración `cleanup_legacy_reputation_objects.sql` retira, después de validar el despliegue de aplicación:

- `dashboard_kpis`
- `dashboard_restaurantes`
- `kpi_marcas`
- `kpi_restaurantes`
- `kpi_diario`
- `kpi_semanal`
- `kpi_mensual`
- `kpi_semana_actual`
- `motivos_diarios`
- `motivos_semanales`
- `motivos_mensuales`
- `v_motivos_base`
- `get_kpis_periodo(...)`
- `actualizar_kpi_semana_actual()`

No se usa `CASCADE`: si queda una dependencia inesperada, PostgreSQL debe detener la limpieza en vez de eliminarla silenciosamente.

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
- Todavía no existe un modelo normalizado para ventas, tiempos, personal o costes.
- La seguridad en base de datos puede reforzarse.

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

El catálogo de restaurantes se lee directamente de `restaurantes + marcas`; la vista `kpi_restaurantes` ya no es una dependencia de aplicación.

El impacto mostrado en imágenes y alertas procede de `nexo_review_rating_impacts(...)`, calculado sobre el histórico canónico del restaurante.

Los motivos agregados proceden de `nexo_reputation_period_motives(...)`, que usa `resena_motivos`.

No existe un segundo calculador TypeScript de medias como fuente alternativa.
