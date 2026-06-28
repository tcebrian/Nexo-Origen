-- Tabla kpi_diario: un registro por restaurante y día
-- Columnas usadas por el dashboard:
--   restaurante_id, fecha, total_resenas, media, negativas, positivas

-- Ejemplo de inserción desde reseñas:
-- INSERT INTO kpi_diario (restaurante_id, fecha, total_resenas, media, negativas, positivas)
-- SELECT
--   restaurante_id,
--   DATE(fecha_resena AT TIME ZONE 'Europe/Madrid') AS fecha,
--   COUNT(*)::int,
--   ROUND(AVG(estrellas)::numeric, 2),
--   COUNT(*) FILTER (WHERE estrellas <= 2)::int,
--   COUNT(*) FILTER (WHERE estrellas >= 4)::int
-- FROM resenas
-- GROUP BY restaurante_id, DATE(fecha_resena AT TIME ZONE 'Europe/Madrid');

-- Lectura anon (ajusta RLS según tu proyecto):
-- GRANT SELECT ON public.kpi_diario TO anon, authenticated;
