-- Nexo Origen · Restaura la caché de traducciones de reseñas.
--
-- Contexto: lib/translate/resena-translations.ts lee y escribe en
-- public.resenas_traducciones, pero la tabla no existía en producción (la
-- migración 20260822172432 la creó y después desapareció sin dejar rastro).
-- Sin la tabla, cada carga de página volvía a llamar a DeepL para las mismas
-- reseñas (más lento y con coste), porque el upsert fallaba en silencio.
--
-- Diseño: 1 fila por reseña (resena_id = resenas.id). Solo la escribe/lee el
-- servidor con service role, así que RLS queda activo SIN políticas
-- (nada accesible desde anon/authenticated).
--
-- Rollback: drop table public.resenas_traducciones;  (es solo caché; se regenera)

create table if not exists public.resenas_traducciones (
  resena_id        bigint primary key
                   references public.resenas(id) on update cascade on delete cascade,
  idioma_detectado text,
  texto_traducido  text not null,
  created_at       timestamptz not null default now()
);

alter table public.resenas_traducciones enable row level security;

revoke all on public.resenas_traducciones from anon, authenticated;

comment on table public.resenas_traducciones is
  '[REPUTATION|produccion] Caché de traducciones al español de los comentarios de reseñas (1 fila por reseña). ORIGEN: DeepL, escrita por lib/translate/resena-translations.ts la primera vez que se muestra una reseña. USO: mostrar reseñas extranjeras en español sin volver a pagar la traducción. Se puede borrar sin perder datos.';
comment on column public.resenas_traducciones.resena_id is
  'FK → resenas.id. Una traducción por reseña.';
comment on column public.resenas_traducciones.idioma_detectado is
  'Código de idioma detectado por DeepL (ES, EN, FR…). Si es ES no se muestra traducción.';
comment on column public.resenas_traducciones.texto_traducido is
  'Comentario traducido al español.';
