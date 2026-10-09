-- Diagnóstico de envíos rechazados por Meta: el motivo del rechazo se guarda en el propio mensaje.
--
-- Solo tres datos cortos del error de Meta (código, subcódigo y tipo). NO se guarda el cuerpo del
-- error, ni el teléfono, ni el token. Se rellenan cuando Meta rechaza el POST inicial (HTTP 4xx) y
-- se vacían si ese mismo mensaje se reintenta y sale bien. Aditiva e idempotente.

alter table public.conv_mensajes
  add column if not exists provider_error_code    text,
  add column if not exists provider_error_subcode text,
  add column if not exists provider_error_type    text;

comment on column public.conv_mensajes.provider_error_code is
  'error.code de Meta cuando rechazó este envío (p. ej. 132001). NULL si no hubo rechazo.';
comment on column public.conv_mensajes.provider_error_subcode is
  'error.error_subcode de Meta, si lo hubo.';
comment on column public.conv_mensajes.provider_error_type is
  'error.type de Meta (p. ej. OAuthException).';
