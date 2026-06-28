-- =============================================================================
-- KPI por periodo (opcional, recomendado cuando tengas reseñas individuales)
-- Ejecuta esto en el SQL Editor de Supabase cuando la tabla `resenas` tenga datos.
-- =============================================================================
--
-- QUÉ TIENES HOY:
--   kpi_restaurantes = VIEW snapshot por restaurante (totales acumulados + ultima_resena)
--   El dashboard filtra por ultima_resena y muestra esos KPIs.
--
-- QUÉ AÑADE ESTA VISTA:
--   Métricas REALES por restaurante y por día, calculadas desde cada reseña.
--   Así "1ª semana de junio" = solo reseñas con fecha_resena en esos días.
--
-- Después de crear la vista, el dashboard puede leerla (futuro) o puedes
-- materializarla en una tabla kpi_restaurantes_periodo con un job diario.

CREATE OR REPLACE VIEW public.kpi_periodo_diario AS
SELECT
  r.restaurante_id,
  DATE(r.fecha_resena AT TIME ZONE 'Europe/Madrid') AS dia,
  COUNT(*)::int AS total_resenas,
  ROUND(AVG(r.estrellas)::numeric, 2) AS media_total,
  COUNT(*) FILTER (WHERE r.estrellas <= 2)::int AS resenas_negativas,
  COUNT(*) FILTER (WHERE r.estrellas >= 4)::int AS resenas_positivas,
  MAX(r.fecha_resena) AS ultima_resena
FROM public.resenas r
WHERE r.fecha_resena IS NOT NULL
GROUP BY r.restaurante_id, DATE(r.fecha_resena AT TIME ZONE 'Europe/Madrid');

-- Ejemplo: KPI agregado para un rango de fechas (usar desde la app o un RPC)
-- SELECT restaurante_id,
--        SUM(total_resenas) AS total_resenas,
--        ROUND(SUM(media_total * total_resenas) / NULLIF(SUM(total_resenas), 0), 2) AS media_ponderada,
--        SUM(resenas_negativas) AS resenas_negativas
-- FROM kpi_periodo_diario
-- WHERE dia BETWEEN '2026-06-01' AND '2026-06-07'
-- GROUP BY restaurante_id;

-- Permisos lectura con anon key (ajusta según tu RLS)
-- GRANT SELECT ON public.kpi_periodo_diario TO anon, authenticated;
