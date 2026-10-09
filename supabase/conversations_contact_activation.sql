-- NEXO-CONV-015 — Activación manual de contactos de WhatsApp.
--
-- Solo dos fechas en conv_contactos (ambas nullable; un contacto nuevo nace con las dos a NULL):
--   welcome_sent_at        → cuándo Meta aceptó la plantilla de bienvenida (botón manual "Enviar activación").
--   whatsapp_activated_at  → cuándo la persona pulsó "Activar servicio" (o respondió OK).
-- No cambian ningún permiso: los restaurantes siguen saliendo de conv_contacto_empresas y
-- conv_contacto_restaurantes. Aditiva e idempotente.

alter table public.conv_contactos
  add column if not exists welcome_sent_at timestamptz,
  add column if not exists whatsapp_activated_at timestamptz;

comment on column public.conv_contactos.welcome_sent_at is
  'Momento en que Meta aceptó la plantilla bienvenido_nexo enviada a mano desde la ficha. NULL = nunca enviada.';
comment on column public.conv_contactos.whatsapp_activated_at is
  'Momento en que el contacto activó el servicio por WhatsApp (botón Activar servicio u OK). NULL = pendiente. No concede permisos.';
