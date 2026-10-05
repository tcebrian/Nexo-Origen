-- Nexo Origen · Base de Nexo Conversations (área CONVERSATIONS).
--
-- Objetivo: persistir conversaciones de WhatsApp (Cloud API oficial de Meta):
--
--   conv_canales         → un número/cuenta de WhatsApp conectado a UNA empresa
--   conv_contactos       → una persona que habla con Nexo (única por empresa)
--   conv_conversaciones  → el chat: un canal ↔ un contacto
--   conv_mensajes        → cada mensaje (hecho), entrante o saliente
--
-- Decisiones de diseño (ver NEXO-CONV-004):
--   · Aislamiento de tenant: empresa_id en todas las tablas y CLAVES FORÁNEAS
--     COMPUESTAS que impiden unir objetos de empresas distintas (una conversación
--     no puede unir un canal de la empresa A con un contacto de la empresa B; un
--     mensaje no puede colgar de una conversación de otro canal o empresa).
--   · Idempotencia: unique (canal_id, external_id) en conv_mensajes (wamid de Meta).
--   · Un canal NO es un restaurante: más adelante se asignarán restaurantes con una
--     tabla de unión (canal ↔ restaurante). No se crea ahora.
--   · No se crean todavía: handling_mode (bot/humano/pausa), assigned_user_id,
--     transcripción de audio, error de envío, suscripciones a informes. Cada una se
--     añade con `alter table … add column` cuando exista el módulo que la use.
--   · IDs uuid (no enumerables en URLs). TODAS las relaciones son ON DELETE
--     RESTRICT: un DELETE directo de empresa, canal, contacto o conversación que
--     tenga historial queda bloqueado. La eliminación/anonimización por privacidad
--     será una operación explícita posterior, no un CASCADE accidental.
--   · nombre (editable por Nexo) y nombre_perfil (el de WhatsApp) son conceptos
--     distintos; la UI usará nombre → nombre_perfil → teléfono.
--   · updated_at lo mantiene la aplicación (sin triggers), como restaurante_metricas.
--
-- Cambio aditivo: no toca tablas, funciones ni datos existentes.
-- Solo servidor: RLS activo sin políticas; el webhook usa service role (server-only).
--
-- Rollback (solo si aún no hay datos que conservar):
--   drop table public.conv_mensajes, public.conv_conversaciones,
--              public.conv_contactos, public.conv_canales;

-- 1) Canales ---------------------------------------------------------------------
create table if not exists public.conv_canales (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          bigint not null
                      references public.empresas(id) on update cascade on delete restrict,
  provider            text not null check (provider in ('whatsapp_cloud')),
  external_account_id text not null check (btrim(external_account_id) <> ''),
  waba_id             text,
  display_phone       text,
  -- Nace desactivado: el webhook solo acepta mensajes de canales 'connected'.
  status              text not null default 'disabled'
                      check (status in ('connected', 'disabled', 'error')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- La misma cuenta externa no puede registrarse dos veces (ni en otra empresa).
  unique (provider, external_account_id),
  -- Objetivo de las claves foráneas compuestas de conv_conversaciones.
  unique (id, empresa_id)
);

-- 2) Contactos -------------------------------------------------------------------
create table if not exists public.conv_contactos (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          bigint not null
                      references public.empresas(id) on update cascade on delete restrict,
  telefono_e164       text not null check (telefono_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  nombre              text check (nombre is null or btrim(nombre) <> ''),
  nombre_perfil       text,
  external_contact_id text,
  usuario_id          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Sin duplicados dentro de la empresa; el mismo teléfono puede existir en otra.
  unique (empresa_id, telefono_e164),
  unique (id, empresa_id)
);

-- 3) Conversaciones --------------------------------------------------------------
create table if not exists public.conv_conversaciones (
  id                     uuid primary key default gen_random_uuid(),
  empresa_id             bigint not null,
  canal_id               uuid not null,
  contacto_id            uuid not null,
  estado                 text not null default 'open' check (estado in ('open', 'closed')),
  ultimo_mensaje_at      timestamptz,
  ultimo_mensaje_preview text check (
                           ultimo_mensaje_preview is null
                           or char_length(ultimo_mensaje_preview) <= 200
                         ),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- Un chat por canal y persona; se reabre en lugar de duplicarse.
  unique (canal_id, contacto_id),
  -- Objetivo de la clave foránea compuesta de conv_mensajes.
  unique (id, empresa_id, canal_id),
  -- Coherencia de tenant: canal y contacto deben ser de la MISMA empresa.
  foreign key (canal_id, empresa_id)
    references public.conv_canales (id, empresa_id)
    on update cascade on delete restrict,
  foreign key (contacto_id, empresa_id)
    references public.conv_contactos (id, empresa_id)
    on update cascade on delete restrict
);

-- 4) Mensajes --------------------------------------------------------------------
create table if not exists public.conv_mensajes (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         bigint not null,
  conversacion_id    uuid not null,
  canal_id           uuid not null,
  -- wamid de Meta. NULL solo en salientes que el proveedor no llegó a aceptar.
  external_id        text,
  direction          text not null check (direction in ('inbound', 'outbound')),
  sender_type        text not null check (sender_type in ('contact', 'human', 'ai', 'system')),
  content_type       text not null check (content_type in
                       ('text', 'image', 'audio', 'video', 'document', 'sticker', 'unsupported')),
  text               text,
  media              jsonb check (media is null or jsonb_typeof(media) = 'object'),
  status             text not null default 'received' check (status in
                       ('received', 'sent', 'delivered', 'read', 'failed', 'deleted')),
  provider_timestamp timestamptz not null,
  received_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  raw_payload        jsonb,
  -- Protección principal contra duplicados (reintentos del webhook).
  unique (canal_id, external_id),
  -- La conversación debe ser de este mismo canal y empresa.
  foreign key (conversacion_id, empresa_id, canal_id)
    references public.conv_conversaciones (id, empresa_id, canal_id)
    on update cascade on delete restrict,
  check (external_id is null or btrim(external_id) <> ''),
  -- Todo mensaje entrante se identifica por su id externo (idempotencia).
  check (direction = 'outbound' or external_id is not null),
  -- Entrante ⇒ lo escribe el contacto; saliente ⇒ humano, IA o sistema.
  check (
    (direction = 'inbound'  and sender_type = 'contact') or
    (direction = 'outbound' and sender_type in ('human', 'ai', 'system'))
  ),
  -- Estados coherentes con la dirección (los de entrega solo existen en salientes).
  check (
    (direction = 'inbound'  and status in ('received', 'deleted')) or
    (direction = 'outbound' and status in ('sent', 'delivered', 'read', 'failed', 'deleted'))
  ),
  -- Invariantes que garantiza el parser: texto con texto, medios con metadatos.
  check (content_type <> 'text' or text is not null),
  check (content_type not in ('image', 'audio', 'video', 'document', 'sticker') or media is not null)
);

-- 5) Índices (solo casos de uso reales) ------------------------------------------
-- Bandeja de entrada: conversaciones de una empresa, las más recientes primero.
create index if not exists idx_conv_conversaciones_empresa_ultimo
  on public.conv_conversaciones (empresa_id, ultimo_mensaje_at desc nulls last);
-- Chats de una persona (y comprobación rápida al intentar borrar un contacto).
create index if not exists idx_conv_conversaciones_contacto
  on public.conv_conversaciones (contacto_id);
-- Hilo de una conversación ordenado por fecha del proveedor.
create index if not exists idx_conv_mensajes_conversacion_fecha
  on public.conv_mensajes (conversacion_id, provider_timestamp desc);
-- Ya cubiertos por claves únicas (no se duplican):
--   canal por (provider, external_account_id)  → conv_canales
--   contacto por (empresa_id, telefono_e164)   → conv_contactos
--   mensaje por (canal_id, external_id)        → conv_mensajes

-- 6) Seguridad: solo servidor (service role). RLS activo sin políticas. ----------
alter table public.conv_canales        enable row level security;
alter table public.conv_contactos      enable row level security;
alter table public.conv_conversaciones enable row level security;
alter table public.conv_mensajes       enable row level security;

revoke all on public.conv_canales, public.conv_contactos,
              public.conv_conversaciones, public.conv_mensajes
  from anon, authenticated;

-- 7) Documentación visible en Supabase -------------------------------------------
comment on table public.conv_canales is
  '[CONVERSATIONS|preparado] Número/cuenta de WhatsApp conectado a Nexo (hoy solo WhatsApp Cloud API oficial de Meta). Pertenece a UNA empresa y podrá atender varios de sus restaurantes. ORIGEN: alta manual/administración (servidor). USO: el webhook resuelve empresa y canal por (provider, external_account_id); solo acepta canales connected.';
comment on column public.conv_canales.empresa_id is 'FK → empresas.id. Tenant dueño del canal. Todo lo que cuelgue del canal pertenece a esta empresa (claves compuestas).';
comment on column public.conv_canales.provider is 'Proveedor del canal. Solo whatsapp_cloud (API oficial de Meta, sin intermediarios).';
comment on column public.conv_canales.external_account_id is 'ID de la cuenta en el proveedor. Para whatsapp_cloud es el phone_number_id de Meta (no el teléfono visible). Único por proveedor.';
comment on column public.conv_canales.waba_id is 'ID de la cuenta de WhatsApp Business (WABA) en Meta, si se conoce.';
comment on column public.conv_canales.display_phone is 'Teléfono visible del canal, solo para mostrar.';
comment on column public.conv_canales.status is 'connected (recibe), disabled (ignorado; valor inicial) o error. Sin secretos: los tokens van en variables de entorno.';

comment on table public.conv_contactos is
  '[CONVERSATIONS|preparado] Persona que habla con Nexo por un canal, única por empresa (empresa_id + teléfono E.164). Datos personales. ORIGEN: webhook de mensajes entrantes (servidor) o alta manual futura. USO: identifica quién escribe; base para asignarle restaurantes, informes y bots en fases posteriores.';
comment on column public.conv_contactos.telefono_e164 is 'Teléfono normalizado E.164 (+34688718820), producido por lib/conversations/normalize-phone.ts. Único por empresa.';
comment on column public.conv_contactos.nombre is 'Nombre interno editable por Nexo (p. ej. José Ramón). Distinto de nombre_perfil. La interfaz muestra nombre; si no hay, nombre_perfil; si tampoco, el teléfono. Nunca lo sobrescribe el proveedor.';
comment on column public.conv_contactos.nombre_perfil is 'Nombre de perfil que declara el contacto en WhatsApp (p. ej. "JR 🍔"). Lo actualiza el webhook, puede cambiar y no es un nombre verificado.';
comment on column public.conv_contactos.external_contact_id is 'ID del contacto en el proveedor (wa_id de WhatsApp), si se conoce.';
comment on column public.conv_contactos.usuario_id is 'FK → auth.users.id. Usuario de Nexo que es esta persona, si lo es. SET NULL si se borra el usuario. La coherencia de empresa con perfiles.empresa_id la valida la aplicación.';

comment on table public.conv_conversaciones is
  '[CONVERSATIONS|preparado] Chat entre un canal de la empresa y un contacto (uno por pareja canal+contacto; se reabre, no se duplica). ORIGEN: webhook de mensajes entrantes (servidor). USO: bandeja de conversaciones por empresa ordenada por último mensaje; padre de conv_mensajes.';
comment on column public.conv_conversaciones.empresa_id is 'Tenant. Las claves compuestas obligan a que canal y contacto sean de esta misma empresa.';
comment on column public.conv_conversaciones.estado is 'open o closed. No indica quién atiende (bot/humano): eso se añadirá con ese módulo.';
comment on column public.conv_conversaciones.ultimo_mensaje_at is 'provider_timestamp del mensaje más reciente (usar el mayor, no el último recibido). Orden de la bandeja. NULL si aún no hay mensajes.';
comment on column public.conv_conversaciones.ultimo_mensaje_preview is 'Vista previa corta (máx. 200 caracteres) del último mensaje, solo para la lista.';

comment on table public.conv_mensajes is
  '[CONVERSATIONS|preparado] HECHOS: cada mensaje de WhatsApp, entrante o saliente, con su estado de entrega y metadatos de medios (nunca binarios). Contiene datos personales. ORIGEN: webhook de Meta (entrantes y estados) y envío desde Nexo (salientes), siempre vía servidor. USO: hilo de la conversación; unique (canal_id, external_id) hace idempotente el webhook.';
comment on column public.conv_mensajes.empresa_id is 'Tenant. La clave compuesta con la conversación impide que difiera de la empresa de la conversación o del canal.';
comment on column public.conv_mensajes.external_id is 'wamid de Meta. Obligatorio en entrantes; NULL solo en salientes no aceptados por el proveedor. Único por canal (idempotencia).';
comment on column public.conv_mensajes.direction is 'inbound (del contacto a Nexo) u outbound (de Nexo al contacto). Igual que MessageDirection en lib/conversations/types.ts.';
comment on column public.conv_mensajes.sender_type is 'Quién lo origina: contact (siempre en entrantes), human, ai o system (salientes). Igual que MessageSenderType.';
comment on column public.conv_mensajes.content_type is 'text, image, audio, video, document, sticker o unsupported. Igual que MessageContentType.';
comment on column public.conv_mensajes.text is 'Contenido de los mensajes de texto. El pie de un medio va en media.caption.';
comment on column public.conv_mensajes.media is 'Metadatos del medio (externalMediaId, mimeType, filename, caption, isVoiceMessage). NUNCA el binario; se descargará aparte cuando exista ese módulo.';
comment on column public.conv_mensajes.status is 'received (entrantes) o sent/delivered/read/failed/deleted (salientes). Igual que MessageStatus.';
comment on column public.conv_mensajes.provider_timestamp is 'Momento del evento según el proveedor. Ordena el hilo; no se sustituye por now() aunque llegue tarde.';
comment on column public.conv_mensajes.received_at is 'Cuándo lo recibió Nexo (fecha de recepción, distinta de la del proveedor).';
comment on column public.conv_mensajes.raw_payload is 'Fragmento original del proveedor para depuración/reproceso. Contiene datos personales: definir retención antes de producción.';
