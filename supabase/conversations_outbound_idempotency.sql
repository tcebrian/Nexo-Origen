-- NEXO-CONV-010 — Envío de texto saliente: idempotencia en conv_mensajes.
--
-- Problema: un doble clic o un reintento del navegador no debe enviar dos
-- WhatsApps. Meta no ofrece clave de idempotencia, así que la reserva se hace en
-- nuestra base ANTES de llamar a Meta:
--
--   1. INSERT del saliente con client_request_id (único) y estado 'pending'.
--      Si ya existe ese client_request_id, la petición es un reintento: NO se envía.
--   2. Llamada a Meta.
--   3. UPDATE a 'sent' + wamid (aceptado) o a 'failed' (rechazo definitivo 4xx).
--      Cualquier otro resultado (timeout, red, 5xx) deja la fila en 'pending':
--      resultado incierto, y un reintento con el mismo id nunca reenvía.
--
-- Cambios (aditivos; la tabla solo contiene entrantes, que no se ven afectados):
--   · conv_mensajes.client_request_id uuid  (solo salientes) + índice único parcial.
--   · Nuevo estado 'pending' SOLO para salientes (reservado, resultado de Meta aún
--     desconocido). 'pending' ⇒ external_id NULL; sent/delivered/read ⇒ external_id.
--
-- Idempotente: se puede ejecutar más de una vez.
-- Rollback (si no hay filas 'pending'):
--   drop index public.conv_mensajes_client_request_id_key;
--   alter table public.conv_mensajes drop column client_request_id;
--   y restaurar conv_mensajes_status_check / conv_mensajes_check2 sin 'pending'.

alter table public.conv_mensajes
  add column if not exists client_request_id uuid;

create unique index if not exists conv_mensajes_client_request_id_key
  on public.conv_mensajes (client_request_id)
  where client_request_id is not null;

alter table public.conv_mensajes
  drop constraint if exists conv_mensajes_client_request_id_outbound_check;
alter table public.conv_mensajes
  add constraint conv_mensajes_client_request_id_outbound_check
  check (client_request_id is null or direction = 'outbound');

-- Estados: se añade 'pending' (solo saliente).
alter table public.conv_mensajes drop constraint if exists conv_mensajes_status_check;
alter table public.conv_mensajes
  add constraint conv_mensajes_status_check
  check (status in ('received', 'pending', 'sent', 'delivered', 'read', 'failed', 'deleted'));

alter table public.conv_mensajes drop constraint if exists conv_mensajes_check2;
alter table public.conv_mensajes
  add constraint conv_mensajes_check2
  check (
    (direction = 'inbound'  and status in ('received', 'deleted')) or
    (direction = 'outbound' and status in ('pending', 'sent', 'delivered', 'read', 'failed', 'deleted'))
  );

-- Coherencia con el id de Meta: reservado ⇒ aún sin wamid; aceptado ⇒ con wamid.
alter table public.conv_mensajes
  drop constraint if exists conv_mensajes_outbound_external_id_check;
alter table public.conv_mensajes
  add constraint conv_mensajes_outbound_external_id_check
  check (
    (status = 'pending' and external_id is null) or
    (status in ('sent', 'delivered', 'read') and direction = 'outbound' and external_id is not null) or
    status in ('received', 'failed', 'deleted')
  );

comment on column public.conv_mensajes.client_request_id is
  'Id de petición generado por el cliente para un saliente (idempotencia del envío). Único. NULL en entrantes.';
