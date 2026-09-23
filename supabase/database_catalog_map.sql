-- Nexo Origen · Catálogo autodocumentado de la base de datos.
--
-- Convención (una sola, para tablas, vistas, funciones y columnas):
--
--     [AREA|estado] Qué es. ORIGEN: quién/qué la rellena. USO: quién la lee.
--
--   AREA    CORE · ACCESS · REPUTATION · OPERACIONES · BOT · INTEGRATIONS
--           · INTERNAL · LEGACY
--   estado  produccion · preparado (creado pero aún sin datos) · shadow
--           (solo pruebas) · compatibilidad (aún puede haber lectores)
--           · retirar (candidato a borrar)
--
-- Los comentarios viven en la propia base de datos, así que se ven en el panel de
-- Supabase y NO se pueden quedar desactualizados respecto a lo que existe: las
-- vistas nexo_mapa_* se generan leyendo el catálogo de Postgres.
--
--   nexo_mapa_sistema      → todo lo que existe (tablas, vistas, funciones), por área
--   nexo_mapa_conexiones   → cómo se unen las tablas (claves foráneas + uniones lógicas)
--   nexo_mapa_automatismos → qué se ejecuta solo (triggers) y qué hace
--
-- Un objeto nuevo sin comentario aparece como "sin_documentar": la regla es que
-- ninguna migración futura debe dejarlo así.
--
-- Solo documentación + 3 vistas de lectura. No cambia datos ni lógica.
-- Rollback: drop view public.nexo_mapa_sistema, public.nexo_mapa_conexiones,
--           public.nexo_mapa_automatismos;  (los comentarios son inocuos)

-- ============================================================================
-- 1) TABLAS EXISTENTES
-- ============================================================================
-- CORE ----------------------------------------------------------------------
comment on table public.empresas is
  '[CORE|produccion] Cliente de Nexo (tenant). Nivel superior: empresa → marca → restaurante. ORIGEN: alta manual / onboarding. USO: aislamiento de datos por cliente (perfiles.empresa_id, restaurantes.empresa_id).';
comment on table public.marcas is
  '[CORE|produccion] Marca comercial (Tim Hortons, Burger King…) y su objetivo de rating (objetivo_media). ORIGEN: alta manual. USO: agrupa restaurantes y fija su objetivo de reputación. Nota: no tiene empresa_id; la empresa de una marca se deduce por restaurantes.empresa_id.';
comment on table public.restaurantes is
  '[CORE|produccion] Maestro de restaurantes: identidad interna estable de cada local. ORIGEN: alta manual / onboarding; media_google, total_resenas_google y ultima_actualizacion_google los copia el trigger actualizar_datos_google_restaurante desde las reseñas recibidas. USO: raíz de todo dato por local (reseñas, integraciones, métricas operativas, permisos, bot).';

-- ACCESS --------------------------------------------------------------------
comment on table public.perfiles is
  '[ACCESS|produccion] Perfil de cada usuario que entra en la web (id = auth.users.id): nombre, rol y empresa. ORIGEN: alta de usuarios (Supabase Auth + administración). USO: login y alcance de datos (perfil → empresa → marcas/restaurantes).';
comment on table public.usuario_marcas is
  '[ACCESS|produccion] Qué marcas puede ver cada usuario. ORIGEN: administración manual. USO: filtro de alcance de datos en la aplicación (seguridad crítica: el aislamiento lo aplica el servidor).';
comment on table public.usuario_restaurantes is
  '[ACCESS|produccion] Qué restaurantes concretos puede ver cada usuario. ORIGEN: administración manual. USO: filtro de alcance de datos en la aplicación (seguridad crítica).';

-- REPUTATION ----------------------------------------------------------------
comment on table public.resenas is
  '[REPUTATION|produccion] Reseñas de Google: una fila por reseña (estado actual). ORIGEN: scraping de Google Maps (Apify) que entra por los flujos de ingesta; los triggers completan restaurante_id, motivo, historial y datos Google. USO: única fuente de reputación: alimenta nexo_canonical_reviews → KPIs de la web, informes, alertas y Asistente Nexo. Ojo: restaurante_nombre, direccion, ciudad, place_id, media_google y total_resenas_google son copias que trae el scraper; la verdad está en restaurantes.';
comment on table public.analisis_ia is
  '[REPUTATION|produccion] Análisis por IA de una reseña (resumen, motivo, impacto, recomendación, riesgo, empleado mencionado, sentimiento). 1 fila por review_id. ORIGEN: flujo de IA externo sobre reseñas nuevas. USO: "Resumen IA" en alertas e informes; su motivo refina resena_motivos (trigger sync_motivo_desde_analisis_ia). No existe para todas las reseñas.';
comment on table public.resena_motivos is
  '[REPUTATION|produccion] Motivo operativo (TIEMPO_ESPERA, PRECIO, LIMPIEZA…) de las reseñas de atención (1-3 estrellas). 1 fila por review_id. ORIGEN: triggers sync_motivo_desde_resena (reglas) y sync_motivo_desde_analisis_ia (IA, prevalece). USO: distribución de motivos en web, informes y bot.';
comment on table public.resenas_historial is
  '[REPUTATION|produccion] Historial de ediciones de reseñas: valores anteriores y nuevos de estrellas y comentario. ORIGEN: trigger registrar_edicion_resena al cambiar una reseña. USO: auditoría y análisis de reseñas editadas; no alimenta KPIs.';

-- BOT -----------------------------------------------------------------------
comment on table public.nexo_bot_accesos is
  '[BOT|produccion] Un agente (Asistente Nexo) por teléfono de WhatsApp: qué locales ve, si recibe alertas y resumen diario, a qué hora y en qué modo (piloto/activo/pausado). ORIGEN: alta y edición desde la web (lib/agents/control.ts). USO: el bot valida cada consulta contra esta tabla; alertas y resúmenes solo se envían a agentes activos.';
comment on table public.nexo_bot_sesiones is
  '[BOT|produccion] Sesión diaria del asistente por teléfono y entorno (live/test). ORIGEN: nexo_bot_memoria_abrir. USO: agrupa las conversaciones del día. Se purga a los 30 días (nexo_bot_memoria_limpiar).';
comment on table public.nexo_bot_conversaciones is
  '[BOT|produccion] Memoria temporal del asistente: cada pregunta y respuesta por teléfono. ORIGEN: nexo_bot_memoria_abrir / nexo_bot_memoria_cerrar. USO: dar contexto a preguntas de seguimiento y auditar respuestas. Se purga a los 30 días.';
comment on table public.nexo_bot_alertas_envios is
  '[BOT|produccion] Registro de alertas de reseña negativa ya enviadas, por reseña y teléfono. ORIGEN: nexo_bot_alerta_confirmar_v1 tras enviar el WhatsApp. USO: evita duplicados; la vista nexo_bot_alertas_pendientes excluye lo ya enviado.';
comment on table public.nexo_bot_resumenes_envios is
  '[BOT|produccion] Control del resumen diario por agente y día local: mensaje, estado, intentos y proveedor. ORIGEN: lib/agents/daily-summary-delivery.ts. USO: no enviar dos veces el mismo día y reintentar fallos.';

-- INTEGRATIONS --------------------------------------------------------------
comment on table public.restaurante_integraciones is
  '[INTEGRATIONS|produccion] Fuentes de datos externas de cada restaurante (google_maps, apify, google_business, storeace, other): estado, referencia externa y última sincronización. UNIQUE (restaurante_id, provider). ORIGEN: onboarding y flujos de ingesta. USO: saber qué está conectado y sitio único para los IDs externos (external_ref) de StoreAce, TPV, delivery… Un proveedor nuevo = ampliar el CHECK de provider.';
comment on table public.restaurante_fuente_aliases is
  '[INTEGRATIONS|produccion] Alias para reconocer a qué restaurante pertenece un dato externo cuando no trae place_id (p. ej. dirección que contiene un texto). ORIGEN: alta manual. USO: trigger asignar_restaurante_id.';

-- INTERNAL ------------------------------------------------------------------
comment on table public.review_identity_shadow_events is
  '[INTERNAL|shadow] Laboratorio de identidad de reseñas (detecta ediciones/recreaciones). ORIGEN: trigger capture_review_identity_shadow (falla en silencio, nunca bloquea). USO: solo análisis; NUNCA debe alimentar KPIs de producción.';
comment on table public.nexo_metric_validation_events is
  '[INTERNAL|shadow] Auditoría de discrepancias entre el cálculo canónico (SQL) y el antiguo (TypeScript). ORIGEN: lib/dashboard-data.ts al comparar ambos. USO: revisar antes de retirar el cálculo antiguo.';

-- LEGACY --------------------------------------------------------------------
comment on table public.kpi_diario is
  '[LEGACY|compatibilidad] KPI diario antiguo, congelado en junio 2026. ORIGEN: proceso antiguo ya parado. USO: solo la página de diagnóstico app/test-supabase; la web usa nexo_reputation_daily_metrics. Retirar cuando se elimine esa página.';
comment on table public.kpi_semanal is
  '[LEGACY|retirar] KPI semanal antiguo. ORIGEN: proceso antiguo. USO: ninguno en la web (verificado en app/ y lib/). Fuente oficial: nexo_reputation_period_metrics.';
comment on table public.kpi_mensual is
  '[LEGACY|retirar] KPI mensual antiguo. ORIGEN: proceso antiguo. USO: ninguno en la web (verificado en app/ y lib/). Fuente oficial: nexo_reputation_period_metrics.';
comment on table public.kpi_semana_actual is
  '[LEGACY|retirar] Snapshot antiguo de la semana en curso. ORIGEN: función actualizar_kpi_semana_actual (legacy). USO: ninguno en la web. Fuente oficial: nexo_reputation_period_metrics.';
comment on table public.alertas_enviadas is
  '[LEGACY|retirar] Registro del sistema antiguo de alertas. ORIGEN: flujo antiguo. USO: ninguno; el sistema actual usa nexo_bot_alertas_envios.';

-- ============================================================================
-- 2) VISTAS EXISTENTES
-- ============================================================================
comment on view public.nexo_bot_alertas_pendientes is
  '[BOT|produccion] Reseñas de 1-2 estrellas pendientes de avisar por WhatsApp, por agente, con el mensaje ya redactado. ORIGEN: cruza resenas + restaurantes + nexo_bot_accesos y descarta lo ya enviado (nexo_bot_alertas_envios). USO: flujo de alertas del bot.';
comment on view public.dashboard_kpis is
  '[LEGACY|compatibilidad] Totales globales de reseñas sin periodo ni deduplicación (negativas = 1-3 estrellas). ORIGEN: cálculo directo sobre resenas. USO: aún lo consulta lib/supabase/dashboard-kpis.ts desde dashboard-data.ts, pero los KPIs oficiales son nexo_reputation_*. Migrar y retirar.';
comment on view public.dashboard_restaurantes is
  '[LEGACY|compatibilidad] Media y reparto por estrellas por restaurante, sin periodo ni deduplicación. ORIGEN: cálculo directo sobre resenas. USO: sin uso en el código de la web (verificado en app/ y lib/); confirmar que ninguna herramienta externa (Make) la lee antes de retirar.';
comment on view public.kpi_marcas is
  '[LEGACY|compatibilidad] Resumen por marca (reseñas, media, negativas). ORIGEN: cálculo directo sobre resenas. USO: sin uso en el código de la web; sustituida por nexo_reputation_brand_metrics. Confirmar con Make antes de retirar.';
comment on view public.kpi_restaurantes is
  '[LEGACY|compatibilidad] Resumen por restaurante con estado Bien/Regular/Mal (umbral 4.4 fijo). ORIGEN: cálculo directo sobre resenas. USO: sin uso en la web; sustituida por nexo_reputation_restaurant_catalog + nexo_reputation_period_metrics. Confirmar con Make antes de retirar.';
comment on view public.resumen_restaurantes is
  '[LEGACY|compatibilidad] Total, media y última reseña por restaurante. ORIGEN: cálculo directo sobre resenas. USO: sin uso en el código de la web. Confirmar con Make antes de retirar.';
comment on view public.v_motivos_base is
  '[LEGACY|compatibilidad] Base de las vistas motivos_*: reseñas 1-3 estrellas con su motivo, restaurante, marca y empresa. ORIGEN: resenas + resena_motivos + restaurantes. USO: solo motivos_diarios/semanales/mensuales; sustituida por nexo_reputation_motives_*.';
comment on view public.motivos_diarios is
  '[LEGACY|compatibilidad] Motivos por restaurante y día. ORIGEN: v_motivos_base. USO: sin uso en la web; sustituida por nexo_reputation_motives_breakdown. Confirmar con Make antes de retirar.';
comment on view public.motivos_semanales is
  '[LEGACY|compatibilidad] Motivos por restaurante y semana. ORIGEN: v_motivos_base. USO: sin uso en la web; sustituida por nexo_reputation_motives_breakdown. Confirmar con Make antes de retirar.';
comment on view public.motivos_mensuales is
  '[LEGACY|compatibilidad] Motivos por restaurante y mes. ORIGEN: v_motivos_base. USO: sin uso en la web; sustituida por nexo_reputation_motives_breakdown. Confirmar con Make antes de retirar.';

-- ============================================================================
-- 3) FUNCIONES
-- ============================================================================
-- REPUTATION · cálculo oficial (Postgres es el único sitio donde se calcula) ---
comment on function public.nexo_canonical_reviews(date, date, bigint[]) is
  '[REPUTATION|produccion] Flujo canónico de reseñas: deduplicado por review_id y por contenido, solo restaurantes activos; la fecha de actividad es la de edición si la reseña fue editada. ORIGEN: resenas + restaurantes. USO: base de TODOS los cálculos de reputación (web, bot, informes Make).';
comment on function public.nexo_reputation_period_metrics(date, date, bigint[]) is
  '[REPUTATION|produccion] KPIs oficiales por restaurante y periodo: total, media exacta, positivas (4-5), neutras (3), negativas (1-2), atención (1-3), reparto por estrellas y estado operativo, más los totales de red. ORIGEN: resenas (lógica canónica). USO: web (dashboard e informes), bot e informe diario Make.';
comment on function public.nexo_reputation_daily_metrics(date, date, bigint[]) is
  '[REPUTATION|produccion] Serie diaria oficial por restaurante y red. ORIGEN: nexo_canonical_reviews. USO: gráficas de la web.';
comment on function public.nexo_reputation_restaurant_catalog(bigint[]) is
  '[REPUTATION|produccion] Catálogo de restaurantes activos con marca, empresa, ciudad y objetivo. ORIGEN: restaurantes + marcas + empresas. USO: web e informe diario Make. Sustituye a la vista kpi_restaurantes.';
comment on function public.nexo_reputation_period_motives(date, date, bigint[]) is
  '[REPUTATION|produccion] Distribución de motivos de atención (1-3 estrellas) que usa la web. ORIGEN: resenas + resena_motivos (por fecha original, sin deduplicar). USO: gráficas de motivos de la web. Aviso: puede diferir en unas pocas reseñas de nexo_reputation_motives_period (canónica, la que usa el bot); unificar es una decisión pendiente.';
comment on function public.nexo_reputation_motives_period(date, date, bigint[]) is
  '[REPUTATION|produccion] Distribución de motivos de atención (1-3 estrellas) sobre el flujo canónico. ORIGEN: nexo_canonical_reviews + resena_motivos. USO: Asistente Nexo (nexo_bot_consulta_core_v4).';
comment on function public.nexo_reputation_motives_breakdown(date, date, bigint[]) is
  '[REPUTATION|preparado] Motivos por restaurante y red, con porcentajes, sobre el flujo canónico. ORIGEN: nexo_canonical_reviews + resena_motivos. USO: no la llama la web ni otra función; pensada para informes por restaurante (posible uso desde Make).';
comment on function public.nexo_reputation_brand_metrics(date, date, bigint[]) is
  '[REPUTATION|preparado] KPIs por marca (reseñas, media, positivas/negativas, reparto de reseñas, restaurantes en objetivo/vigilancia/críticos). ORIGEN: nexo_reputation_period_metrics + marcas. USO: no la llama la web ni otra función; pensada para informes por marca (posible uso desde Make).';
comment on function public.nexo_review_rating_impacts(bigint[]) is
  '[REPUTATION|preparado] Cuánto sube o baja la media del restaurante cada reseña concreta (media antes/después). ORIGEN: resenas. USO: no la llama la web ni otra función; pensada para alertas con impacto (posible uso desde Make).';
comment on function public.clasificar_motivo_nexo(text, integer) is
  '[REPUTATION|produccion] Clasificador por reglas (palabras clave multi-idioma) que asigna un motivo a una reseña de 1-3 estrellas. ORIGEN: reglas dentro de la función (inmutable). USO: triggers sync_motivo_desde_resena y sync_motivo_desde_analisis_ia.';

-- REPUTATION · triggers de resenas --------------------------------------------
comment on function public.asignar_restaurante_id() is
  '[REPUTATION|produccion] Trigger BEFORE INSERT en resenas: si la reseña llega sin restaurante_id lo deduce por place_id y, si no, por integraciones/alias de dirección. ORIGEN: restaurantes, restaurante_integraciones, restaurante_fuente_aliases. USO: garantiza que cada reseña quede unida a su local.';
comment on function public.actualizar_datos_google_restaurante() is
  '[REPUTATION|produccion] Trigger AFTER INSERT/UPDATE en resenas: copia media_google y total_resenas_google de la reseña al restaurante (por place_id) y marca ultima_actualizacion_google. ORIGEN: datos del scraper en resenas. USO: mantener al día la nota pública de Google en restaurantes.';
comment on function public.preservar_fecha_resena_y_capturar_edicion_google() is
  '[REPUTATION|produccion] Trigger BEFORE UPDATE en resenas: si el scraper cambia la fecha a la vez que estrellas o comentario (edición en Google), guarda la nueva fecha en fecha_edicion_google y restaura la fecha original en fecha_resena. USO: fecha_resena nunca se sobrescribe.';
comment on function public.registrar_edicion_resena() is
  '[REPUTATION|produccion] Trigger BEFORE UPDATE en resenas: si cambian estrellas o comentario, guarda los valores anteriores en resenas_historial y marca editada = true y fecha_ultima_edicion. USO: historial de ediciones; la fecha de edición mueve la reseña al periodo de actividad canónico.';
comment on function public.sync_motivo_desde_resena() is
  '[REPUTATION|produccion] Trigger AFTER INSERT/UPDATE en resenas: clasifica por reglas las de 1-3 estrellas y guarda el motivo en resena_motivos, sin pisar los motivos que vienen de IA. USO: motivo disponible desde que entra la reseña.';
comment on function public.sync_motivo_desde_analisis_ia() is
  '[REPUTATION|produccion] Trigger AFTER INSERT/UPDATE en analisis_ia: reclasifica el motivo usando el análisis IA (fuente auto_ia_v1) y actualiza resena_motivos. USO: el motivo de IA prevalece sobre el de reglas.';

-- BOT ---------------------------------------------------------------------------
comment on function public.nexo_bot_consulta_core_v4(text, text) is
  '[BOT|produccion] Motor de consultas del Asistente Nexo (versión vigente): valida el teléfono, resuelve alcance y periodo y devuelve KPIs canónicos. ORIGEN: nexo_bot_accesos + nexo_reputation_period_metrics + nexo_reputation_motives_period. USO: llamada por nexo_bot_consulta_v1/v3 y nexo_bot_contexto_core_v4.';
comment on function public.nexo_bot_contexto_core_v4(text, text) is
  '[BOT|produccion] Construye el contexto completo para el modelo de lenguaje del asistente (KPIs, motivos, objetivos, cobertura). ORIGEN: nexo_bot_consulta_core_v4 + nexo_canonical_reviews + resena_motivos. USO: llamada por nexo_bot_contexto_v3.';
comment on function public.nexo_bot_contexto_v3(text, text) is
  '[BOT|produccion] Punto de entrada estable para el contexto del asistente; delega en nexo_bot_contexto_core_v4. USO: flujo del bot (Make/WhatsApp) y nexo_bot_memoria_cerrar.';
comment on function public.nexo_bot_consulta_v3(text, text) is
  '[BOT|compatibilidad] Punto de entrada estable de consultas; delega en nexo_bot_consulta_core_v4. Se conserva por si algún flujo externo aún lo llama; retirar cuando el bot use solo la versión vigente.';
comment on function public.nexo_bot_consulta_v1(text, text) is
  '[BOT|compatibilidad] Versión histórica; delega en nexo_bot_consulta_core_v4. La sigue usando nexo_bot_contexto_v2. Retirar junto con ella.';
comment on function public.nexo_bot_contexto_v2(text, text) is
  '[BOT|compatibilidad] Versión histórica del contexto (sobre nexo_bot_consulta_v1). Sustituida por nexo_bot_contexto_v3. Retirar tras confirmar que ningún flujo externo la llama.';
comment on function public.nexo_bot_memoria_abrir(text, text, text, text) is
  '[BOT|produccion] Abre el turno de conversación: valida el teléfono, crea o recupera la sesión del día y registra la pregunta. ORIGEN: nexo_bot_accesos. USO: primer paso de cada mensaje del bot; escribe en nexo_bot_sesiones y nexo_bot_conversaciones.';
comment on function public.nexo_bot_memoria_cerrar(text, text, text, text, text, text) is
  '[BOT|produccion] Cierra el turno: guarda la respuesta enviada y su id de WhatsApp. USO: último paso de cada mensaje del bot; actualiza nexo_bot_conversaciones.';
comment on function public.nexo_bot_memoria_limpiar() is
  '[BOT|produccion] Borra conversaciones y sesiones con más de 30 días. USO: mantenimiento; no hay pg_cron en esta base, así que la tiene que invocar un flujo externo periódicamente.';
comment on function public.nexo_bot_alerta_confirmar_v1(text, text, text) is
  '[BOT|produccion] Confirma que una alerta de reseña se envió por WhatsApp y la registra en nexo_bot_alertas_envios (idempotente). USO: flujo de alertas, tras enviar el mensaje.';

-- INTEGRATIONS ------------------------------------------------------------------
comment on function public.nexo_make_daily_report_payload(bigint, date, bigint[]) is
  '[INTEGRATIONS|produccion] Payload del informe diario de WhatsApp para Make. ORIGEN: nexo_reputation_period_metrics + nexo_reputation_restaurant_catalog. USO: Make solo formatea y envía; no recalcula KPIs.';

-- INTERNAL ----------------------------------------------------------------------
comment on function public.capture_review_identity_shadow() is
  '[INTERNAL|shadow] Trigger AFTER INSERT/UPDATE en resenas: registra en review_identity_shadow_events si una reseña parece editada o recreada. Falla en silencio para no bloquear la ingesta. NO alimenta KPIs.';
comment on function public.rls_auto_enable() is
  '[INTERNAL|produccion] Event trigger de seguridad: activa RLS automáticamente en cada tabla nueva creada en public. Evita dejar tablas abiertas por descuido.';

-- LEGACY ------------------------------------------------------------------------
comment on function public.get_kpis_periodo(bigint, date, date) is
  '[LEGACY|retirar] KPIs por empresa y periodo del sistema antiguo (negativas = 1-3 estrellas, sin deduplicar). USO: ninguno en la web ni en otras funciones; sustituida por nexo_reputation_period_metrics.';
comment on function public.actualizar_kpi_semana_actual() is
  '[LEGACY|retirar] Recalcula la tabla kpi_semana_actual. USO: ninguno; sustituida por nexo_reputation_period_metrics.';

-- ============================================================================
-- 4) COLUMNAS CLAVE (de dónde sale cada dato)
-- ============================================================================
comment on column public.resenas.review_id is 'ID de la reseña en Google (texto). Único. Clave de unión con analisis_ia, resena_motivos y nexo_bot_alertas_envios.';
comment on column public.resenas.restaurante_id is 'FK → restaurantes.id. Lo rellena el trigger asignar_restaurante_id (por place_id) si el scraper no lo trae. NULL = reseña huérfana: no cuenta en ningún KPI.';
comment on column public.resenas.autor is 'Nombre público del autor en Google.';
comment on column public.resenas.estrellas is 'Valoración 1-5. Positiva 4-5, neutra 3, negativa 1-2; atención = 1-3.';
comment on column public.resenas.comentario is 'Texto original de la reseña (cualquier idioma). Traducción en resenas_traducciones.';
comment on column public.resenas.fecha_resena is 'Fecha ORIGINAL de publicación en Google (sin zona horaria). Nunca se sobrescribe: el trigger la protege ante ediciones.';
comment on column public.resenas.fecha_detectada is 'Momento en que el flujo de ingesta detectó la reseña; puede diferir de fecha_resena.';
comment on column public.resenas.url is 'Enlace a la reseña / perfil del autor en Google Maps.';
comment on column public.resenas.created_at is 'Cuándo entró la fila en Nexo (no es la fecha de la reseña).';
comment on column public.resenas.restaurante_nombre is 'Copia del nombre del local que trae el scraper. La verdad está en restaurantes.nombre.';
comment on column public.resenas.direccion is 'Copia de la dirección que trae el scraper. La verdad está en restaurantes.direccion. Usada como último recurso para asignar restaurante.';
comment on column public.resenas.ciudad is 'Copia de la ciudad que trae el scraper. La verdad está en restaurantes.ciudad.';
comment on column public.resenas.place_id is 'Google Place ID del local (trae el scraper). Une con restaurantes.place_id (único).';
comment on column public.resenas.media_google is 'Nota pública global del local en Google en el momento del scraping. Un trigger la copia a restaurantes.media_google.';
comment on column public.resenas.total_resenas_google is 'Nº total de reseñas públicas del local en Google en el momento del scraping. Un trigger la copia a restaurantes.';
comment on column public.resenas.editada is 'true si estrellas o comentario cambiaron después de la primera captura (lo pone el trigger registrar_edicion_resena).';
comment on column public.resenas.fecha_ultima_edicion is 'Momento en que Nexo detectó la última edición. Si editada, la fecha de actividad canónica es esta (hora Europe/Madrid).';
comment on column public.resenas.google_resource_name is 'Identificador de recurso de la API oficial de Google Business Profile (si la fuente es esa API).';
comment on column public.resenas.google_update_time is 'Fecha de última modificación que informa la API oficial de Google Business Profile.';

comment on column public.restaurantes.nombre is 'Nombre interno del local en Nexo.';
comment on column public.restaurantes.direccion is 'Dirección del local.';
comment on column public.restaurantes.ciudad is 'Ciudad del local.';
comment on column public.restaurantes.activo is 'false = local dado de baja: desaparece de todos los cálculos canónicos, sin borrar su histórico.';
comment on column public.restaurantes.place_id is 'Google Place ID. Único; es la unión natural con resenas.place_id.';
comment on column public.restaurantes.empresa_id is 'FK → empresas.id. Define el tenant (cliente) al que pertenece el local.';
comment on column public.restaurantes.marca_id is 'FK → marcas.id. Marca comercial del local.';
comment on column public.restaurantes.media_google is 'Nota pública actual del local en Google. La actualiza el trigger actualizar_datos_google_restaurante.';
comment on column public.restaurantes.total_resenas_google is 'Nº total de reseñas públicas en Google. La actualiza el mismo trigger.';
comment on column public.restaurantes.ultima_actualizacion_google is 'Última vez que el trigger actualizó media_google/total_resenas_google.';

comment on column public.marcas.objetivo_media is 'Objetivo de rating de la marca (p. ej. 4.4). Umbral de "en objetivo/vigilancia/crítico". Futuro: objetivos con vigencia en la tabla objetivos.';

comment on column public.resena_motivos.categoria is 'Motivo operativo: TIEMPO_ESPERA, ATENCION_PERSONAL, PEDIDO_INCORRECTO, PRECIO, LIMPIEZA, CALIDAD_PRODUCTO, FALTA_PRODUCTO, SEGURIDAD_ALIMENTARIA, DELIVERY, SIN_MOTIVO, OTRO…';
comment on column public.resena_motivos.fuente is 'Quién clasificó: auto_resena_v1 (reglas sobre el comentario) o auto_ia_v1 (a partir de analisis_ia, prevalece).';

comment on column public.analisis_ia.review_id is 'FK → resenas.review_id (única): 1 análisis por reseña.';
comment on column public.analisis_ia.resumen is 'Resumen de la reseña en una frase; se muestra como "Resumen IA".';
comment on column public.analisis_ia.motivo is 'Motivo detectado por la IA (texto libre); el trigger lo convierte en categoría de resena_motivos.';
comment on column public.analisis_ia.impacto is 'Impacto estimado de la reseña según la IA.';
comment on column public.analisis_ia.recomendacion is 'Acción recomendada por la IA para el equipo del local.';
comment on column public.analisis_ia.riesgo is 'Nivel de riesgo según la IA (reputación/seguridad).';
comment on column public.analisis_ia.empleado_mencionado is 'Nombre del empleado citado en la reseña, si lo hay.';
comment on column public.analisis_ia.sentimiento is 'Sentimiento detectado por la IA.';

comment on column public.resenas_historial.resena_id is 'FK → resenas.id (SET NULL si se borra la reseña: el historial se conserva).';
comment on column public.resenas_historial.fecha_cambio is 'Cuándo Nexo detectó la edición.';

comment on column public.restaurante_integraciones.provider is 'Proveedor: google_maps, apify, google_business, storeace, other. Único por restaurante.';
comment on column public.restaurante_integraciones.external_ref is 'ID del local en el sistema externo (Place ID, ID de StoreAce, ID del TPV…). Nexo usa su propio restaurante_id; esto es solo la referencia.';
comment on column public.restaurante_integraciones.config is 'Ajustes específicos del proveedor (JSON). Sin secretos: los tokens van en variables de entorno.';
comment on column public.restaurante_integraciones.last_sync_at is 'Última sincronización correcta con el proveedor.';
comment on column public.restaurante_integraciones.last_error is 'Último error de sincronización, si lo hubo.';

comment on column public.perfiles.rol is 'Rol del usuario: super_admin (todo), empresa_admin (su empresa), marca_admin (sus marcas), restaurante_user (sus locales). Junto a usuario_marcas / usuario_restaurantes define el alcance.';
comment on column public.perfiles.empresa_id is 'FK → empresas.id. Empresa (tenant) del usuario; NULL = sin empresa asignada.';

comment on column public.nexo_bot_accesos.telefono is 'Teléfono WhatsApp (solo dígitos, 8-15). Identifica al agente y une con sesiones, conversaciones y alertas.';
comment on column public.nexo_bot_accesos.todos_restaurantes is 'true = ve todos los locales de su alcance; false = solo restaurante_ids.';
comment on column public.nexo_bot_accesos.restaurante_ids is 'Lista de restaurantes.id visibles (array: no admite FK, se valida en aplicación).';
comment on column public.nexo_bot_accesos.alertas_desde_id is 'Marca de agua: solo se avisa de reseñas con resenas.id mayor. Evita inundar de alertas antiguas al activar.';
comment on column public.nexo_bot_accesos.modo is 'piloto (pruebas), activo (producción) o pausado.';
comment on column public.nexo_bot_accesos.resumen_diario is 'true = recibe el resumen diario.';
comment on column public.nexo_bot_accesos.resumen_hora is 'Hora local (en su timezone) a la que se envía el resumen diario.';
comment on column public.nexo_bot_accesos.timezone is 'Zona horaria IANA del agente para fechas y hora del resumen.';

-- ============================================================================
-- 5) VISTAS DE MAPA (se generan solas leyendo el catálogo de Postgres)
-- ============================================================================
drop view if exists public.nexo_mapa_sistema;

create view public.nexo_mapa_sistema
with (security_invoker = true) as
with objetos as (
  select 'tabla'::text as tipo, 1 as orden_tipo, c.relname::text as objeto,
         obj_description(c.oid, 'pg_class') as comentario,
         nullif(c.reltuples, -1)::bigint as filas_aprox
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
  union all
  select 'vista', 2, c.relname::text, obj_description(c.oid, 'pg_class'), null
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
  union all
  select case when p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype)
              then 'trigger_fn' else 'funcion' end,
         3, p.proname::text, obj_description(p.oid, 'pg_proc'), null
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
)
select
  coalesce(substring(comentario from '^\[([A-Z_]+)'), 'SIN_CLASIFICAR')                 as area,
  tipo,
  objeto,
  coalesce(substring(comentario from '^\[[A-Z_]+\|([a-z_]+)\]'),
           case when comentario is null then 'sin_documentar' else 'produccion' end)     as estado,
  nullif(btrim(regexp_replace(regexp_replace(coalesce(comentario, ''),
        '^\[[A-Za-z_|]*\]\s*', ''), '\s*ORIGEN:.*$', '')), '')                           as descripcion,
  substring(comentario from 'ORIGEN: (.*?)(?: USO:|$)')                                  as origen,
  substring(comentario from 'USO: (.*)$')                                                as uso,
  filas_aprox
from objetos
order by area, orden_tipo, objeto;

comment on view public.nexo_mapa_sistema is
  '[INTERNAL|produccion] Mapa de TODO lo que existe en la base de datos (tablas, vistas, funciones) agrupado por área, con estado, origen y uso. ORIGEN: se genera solo leyendo los comentarios [AREA|estado]… de cada objeto. USO: punto de entrada para entender Supabase; un objeto sin comentario sale como sin_documentar.';

create view public.nexo_mapa_conexiones
with (security_invoker = true) as
select
  'fk'::text as tipo,
  replace(c.conrelid::regclass::text, 'public.', '') as desde_tabla,
  (select string_agg(a.attname, ', ' order by a.attnum)
     from pg_attribute a where a.attrelid = c.conrelid and a.attnum = any(c.conkey)) as desde_columna,
  replace(c.confrelid::regclass::text, 'public.', '') as hacia_tabla,
  (select string_agg(a.attname, ', ' order by a.attnum)
     from pg_attribute a where a.attrelid = c.confrelid and a.attnum = any(c.confkey)) as hacia_columna,
  case c.confdeltype when 'c' then 'borra en cascada'
                     when 'n' then 'pone NULL'
                     when 'r' then 'impide borrar'
                     else 'sin acción' end as al_borrar,
  'Clave foránea real: la base de datos garantiza la unión.'::text as nota
from pg_constraint c
where c.contype = 'f' and c.connamespace = 'public'::regnamespace
union all
select 'logica', v.desde_tabla, v.desde_columna, v.hacia_tabla, v.hacia_columna, '—', v.nota
from (values
  ('resenas', 'place_id', 'restaurantes', 'place_id',
   'Unión alternativa cuando falta restaurante_id; la resuelve el trigger asignar_restaurante_id. place_id es único en restaurantes.'),
  ('nexo_bot_accesos', 'restaurante_ids', 'restaurantes', 'id',
   'Array de ids visibles para el agente: no admite clave foránea; se valida en aplicación.'),
  ('nexo_bot_accesos', 'alertas_desde_id', 'resenas', 'id',
   'Marca de agua (solo se alertan reseñas con id mayor). No es clave foránea a propósito.'),
  ('restaurante_integraciones', 'external_ref', '(sistema externo)', 'id del proveedor',
   'Referencia al ID del local en StoreAce/TPV/delivery/Google. Nexo mantiene su propio restaurante_id.')
) as v(desde_tabla, desde_columna, hacia_tabla, hacia_columna, nota)
order by tipo, desde_tabla, desde_columna;

comment on view public.nexo_mapa_conexiones is
  '[INTERNAL|produccion] Cómo se unen las tablas: claves foráneas reales (leídas del catálogo, siempre al día) más unas pocas uniones lógicas que no admiten FK. ORIGEN: pg_constraint + lista documentada de uniones lógicas. USO: entender de qué depende cada dato y qué pasa al borrar.';

create view public.nexo_mapa_automatismos
with (security_invoker = true) as
select
  replace(t.tgrelid::regclass::text, 'public.', '') as tabla,
  t.tgname::text as trigger,
  case when t.tgtype & 2 = 2 then 'ANTES' else 'DESPUÉS' end as momento,
  concat_ws(' / ',
    case when t.tgtype & 4  = 4  then 'INSERT' end,
    case when t.tgtype & 16 = 16 then 'UPDATE' end,
    case when t.tgtype & 8  = 8  then 'DELETE' end) as evento,
  p.proname::text as funcion,
  nullif(btrim(regexp_replace(regexp_replace(coalesce(obj_description(p.oid, 'pg_proc'), ''),
        '^\[[A-Za-z_|]*\]\s*', ''), '\s*ORIGEN:.*$', '')), '') as que_hace
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and t.tgrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace)
union all
select '(esquema)', e.evtname::text, 'DESPUÉS', e.evtevent::text, p.proname::text,
  nullif(btrim(regexp_replace(regexp_replace(coalesce(obj_description(p.oid, 'pg_proc'), ''),
        '^\[[A-Za-z_|]*\]\s*', ''), '\s*ORIGEN:.*$', '')), '')
from pg_event_trigger e
join pg_proc p on p.oid = e.evtfoid
where p.pronamespace = 'public'::regnamespace   -- solo los de Nexo, no los internos de Supabase
order by 1, 2;

comment on view public.nexo_mapa_automatismos is
  '[INTERNAL|produccion] Todo lo que la base de datos ejecuta sola: triggers por tabla (cuándo, con qué evento, qué función) y triggers de esquema. ORIGEN: pg_trigger + pg_event_trigger + comentario de cada función. USO: saber qué pasa "por detrás" al insertar o editar una reseña.';

-- Solo lectura interna (panel de Supabase / service role). No expuestas por la API pública.
revoke all on public.nexo_mapa_sistema, public.nexo_mapa_conexiones, public.nexo_mapa_automatismos
  from anon, authenticated;
grant select on public.nexo_mapa_sistema, public.nexo_mapa_conexiones, public.nexo_mapa_automatismos
  to service_role;
