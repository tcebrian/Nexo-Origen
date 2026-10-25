-- ROLLBACK de SEC-006 (contador de frecuencia). Elimina la función y la tabla.
-- La aplicación sigue funcionando: vuelve al contador en memoria por instancia (menos fiable en Vercel).
-- Se pierden los contadores actuales (solo son ventanas de un minuto).

begin;

drop function if exists public.nexo_rate_limit_hit(text, integer, integer);
drop table if exists public.api_rate_limits;

commit;
