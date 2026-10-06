-- Nexo Origen · Nexo Conversations: canal central multiempresa (corrige conversations_foundation).
--
-- Por qué: conversations_foundation asumía canal → empresa (empresa_id en las 4
-- tablas). Nexo tiene UN WhatsApp central por el que hablan personas de varias
-- empresas, así que la identidad y los permisos pertenecen a la PERSONA, no al
-- número. Este script sustituye el modelo por uno de canal central.
--
-- Modelo resultante (6 tablas):
--   conv_canales                canal global de Nexo (sin empresa)
--   conv_contactos              persona global, teléfono único en todo Conversations
--   conv_contacto_empresas      persona ↔ empresa (una o varias) + todos_restaurantes
--   conv_contacto_restaurantes  persona ↔ restaurante concreto (coherente con su empresa)
--   conv_conversaciones         canal + contacto (sin empresa)
--   conv_mensajes               mensajes de la conversación (sin empresa)
--
-- Principios:
--   · DENY BY DEFAULT: un contacto sin filas en conv_contacto_empresas /
--     conv_contacto_restaurantes (p. ej. un desconocido que escribe) existe, tiene
--     conversación y mensajes, pero su acceso a datos es CERO.
--   · El tenant de un mensaje ya no es un campo copiado: se resuelve mediante
--     contacto → empresas → restaurantes. La empresa NUNCA se deduce del texto.
--   · Visibilidad inicial de las conversaciones en la web: solo super_admin
--     (se aplica en servidor; estas tablas no tienen políticas RLS).
--   · Sin borrados en cascada: todas las relaciones son RESTRICT.
--
-- Cambios sobre objetos EXISTENTES fuera de conv_*: UNO solo, aditivo:
--   public.restaurantes  +  unique (id, empresa_id)   (restaurantes_id_empresa_id_key)
--   Necesario para que una clave foránea compuesta garantice que un restaurante
--   asignado pertenece a la empresa autorizada. `id` ya es clave primaria, así que
--   la restricción no puede fallar por datos. No toca columnas ni filas.
--   NO se toca nexo_bot_accesos ni nada del bot de Make.
--
-- GUARDA: si CUALQUIER tabla conv_* actual (las 6) contiene filas, el script aborta ANTES
-- de cualquier cambio (incluido el de restaurantes) y no borra nada. Todo ocurre en
-- una sola transacción. Los DROP son sin CASCADE: si algo dependiera de estas tablas,
-- fallarían en lugar de arrastrarlo. Una segunda ejecución sobre una base que ya
-- tenga datos de Conversations también aborta.
--
-- conversations_foundation.sql se conserva como migración histórica (ya aplicada).
-- Un entorno nuevo debe ejecutar ambos en orden: foundation → central_channel.
--
-- Rollback (solo mientras no haya datos): no hay vuelta atrás automática al modelo
-- anterior; recrear conversations_foundation.sql tras borrar las 6 tablas, y
--   alter table public.restaurantes drop constraint restaurantes_id_empresa_id_key;

-- 0) Guarda fuerte --------------------------------------------------------------
-- Bloqueo exclusivo mientras se comprueba: nada puede insertar entre la guarda y el DROP.
do $$
declare
  tabla   text;
  filas   bigint;
begin
  foreach tabla in array array['conv_mensajes', 'conv_conversaciones', 'conv_contacto_restaurantes', 'conv_contacto_empresas', 'conv_contactos', 'conv_canales']
  loop
    if to_regclass(format('public.%I', tabla)) is not null then
      execute format('lock table public.%I in access exclusive mode', tabla);
    end if;
  end loop;

  foreach tabla in array array['conv_mensajes', 'conv_conversaciones', 'conv_contacto_restaurantes', 'conv_contacto_empresas', 'conv_contactos', 'conv_canales']
  loop
    if to_regclass(format('public.%I', tabla)) is not null then
      execute format('select count(*) from public.%I', tabla) into filas;
      if filas > 0 then
        raise exception
          'conversations_central_channel ABORTADA: public.% contiene % fila(s). No se ha cambiado nada. Esta migración solo puede recrear el modelo con las tablas vacías.',
          tabla, filas;
      end if;
    end if;
  end loop;
end
$$;

-- 1) Único cambio sobre una tabla existente ---------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.restaurantes'::regclass
      and conname = 'restaurantes_id_empresa_id_key'
  ) then
    alter table public.restaurantes
      add constraint restaurantes_id_empresa_id_key unique (id, empresa_id);
  end if;
end
$$;

-- 2) Eliminar el modelo anterior (vacío, comprobado arriba; sin CASCADE) -----------
-- En orden de dependencia (hijas primero). Incluye las 2 tablas de permisos para que
-- la migración sea re-ejecutable mientras todo esté vacío.
drop table if exists public.conv_mensajes;
drop table if exists public.conv_conversaciones;
drop table if exists public.conv_contacto_restaurantes;
drop table if exists public.conv_contacto_empresas;
drop table if exists public.conv_contactos;
drop table if exists public.conv_canales;

-- 3) Canal central -----------------------------------------------------------------
create table public.conv_canales (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null check (provider in ('whatsapp_cloud')),
  external_account_id text not null check (btrim(external_account_id) <> ''),
  waba_id             text,
  display_phone       text,
  -- Nace desactivado: el webhook solo acepta mensajes de canales 'connected'.
  status              text not null default 'disabled'
                      check (status in ('connected', 'disabled', 'error')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- La misma cuenta externa no puede registrarse dos veces.
  unique (provider, external_account_id)
);

-- 4) Personas ----------------------------------------------------------------------
create table public.conv_contactos (
  id                  uuid primary key default gen_random_uuid(),
  telefono_e164       text not null check (telefono_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  nombre              text check (nombre is null or btrim(nombre) <> ''),
  nombre_perfil       text,
  external_contact_id text,
  usuario_id          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Una persona = un teléfono en todo Conversations (un único WhatsApp central).
  constraint conv_contactos_telefono_e164_key unique (telefono_e164)
);

-- 5) Persona ↔ empresa --------------------------------------------------------------
create table public.conv_contacto_empresas (
  contacto_id        uuid   not null
                     references public.conv_contactos(id) on update cascade on delete restrict,
  empresa_id         bigint not null
                     references public.empresas(id) on update cascade on delete restrict,
  -- true = todos los restaurantes actuales y futuros de la empresa;
  -- false = solo los de conv_contacto_restaurantes.
  todos_restaurantes boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (contacto_id, empresa_id)
);

-- 6) Persona ↔ restaurante (la base garantiza contacto → empresa → restaurante) -----
create table public.conv_contacto_restaurantes (
  contacto_id    uuid   not null,
  restaurante_id bigint not null,
  empresa_id     bigint not null,
  created_at     timestamptz not null default now(),
  primary key (contacto_id, restaurante_id),
  -- La persona debe pertenecer a esa empresa…
  foreign key (contacto_id, empresa_id)
    references public.conv_contacto_empresas (contacto_id, empresa_id)
    on update cascade on delete restrict,
  -- …y el restaurante debe ser realmente de esa empresa.
  foreign key (restaurante_id, empresa_id)
    references public.restaurantes (id, empresa_id)
    on update restrict on delete restrict
);

-- 7) Conversaciones ------------------------------------------------------------------
create table public.conv_conversaciones (
  id                     uuid primary key default gen_random_uuid(),
  canal_id               uuid not null
                         references public.conv_canales(id) on update cascade on delete restrict,
  contacto_id            uuid not null
                         references public.conv_contactos(id) on update cascade on delete restrict,
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
  unique (id, canal_id)
);

-- 8) Mensajes ------------------------------------------------------------------------
create table public.conv_mensajes (
  id                 uuid primary key default gen_random_uuid(),
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
  -- La conversación debe ser de este mismo canal.
  foreign key (conversacion_id, canal_id)
    references public.conv_conversaciones (id, canal_id)
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

-- 9) Índices (solo casos de uso reales) ------------------------------------------------
-- Personas de una empresa (la clave primaria ya cubre "empresas de una persona").
create index idx_conv_contacto_empresas_empresa
  on public.conv_contacto_empresas (empresa_id);
-- Quién tiene acceso a un restaurante (la clave primaria ya cubre "restaurantes de una
-- persona"); también acelera la comprobación al borrar o mover un restaurante.
create index idx_conv_contacto_restaurantes_restaurante
  on public.conv_contacto_restaurantes (restaurante_id);
-- Bandeja de entrada: conversaciones más recientes primero.
create index idx_conv_conversaciones_ultimo
  on public.conv_conversaciones (ultimo_mensaje_at desc nulls last);
-- Chats de una persona (y comprobación al intentar borrar un contacto).
create index idx_conv_conversaciones_contacto
  on public.conv_conversaciones (contacto_id);
-- Hilo de una conversación ordenado por fecha del proveedor.
create index idx_conv_mensajes_conversacion_fecha
  on public.conv_mensajes (conversacion_id, provider_timestamp desc);
-- Ya cubiertos por claves únicas (no se duplican):
--   canal por (provider, external_account_id)  → conv_canales
--   contacto por teléfono                       → conv_contactos
--   mensaje por (canal_id, external_id)         → conv_mensajes

-- 10) Seguridad: solo servidor (service role). RLS activo sin políticas. -------------
alter table public.conv_canales               enable row level security;
alter table public.conv_contactos             enable row level security;
alter table public.conv_contacto_empresas     enable row level security;
alter table public.conv_contacto_restaurantes enable row level security;
alter table public.conv_conversaciones        enable row level security;
alter table public.conv_mensajes              enable row level security;

revoke all on public.conv_canales, public.conv_contactos,
              public.conv_contacto_empresas, public.conv_contacto_restaurantes,
              public.conv_conversaciones, public.conv_mensajes
  from anon, authenticated;

-- 11) Documentación visible en Supabase ------------------------------------------------
comment on constraint restaurantes_id_empresa_id_key on public.restaurantes is
  'Permite claves foráneas compuestas (restaurante, empresa) desde conv_contacto_restaurantes. id ya es único; no añade restricciones reales.';

comment on table public.conv_canales is
  '[CONVERSATIONS|preparado] Canal central de Nexo: el número/cuenta de WhatsApp (hoy solo WhatsApp Cloud API oficial de Meta) por el que hablan personas de varias empresas. NO pertenece a una empresa: la identidad y los permisos están en la persona (conv_contactos). ORIGEN: alta manual/administración (servidor). USO: el webhook resuelve el canal por (provider, external_account_id); solo acepta canales connected.';
comment on column public.conv_canales.provider is 'Proveedor del canal. Solo whatsapp_cloud (API oficial de Meta, sin intermediarios).';
comment on column public.conv_canales.external_account_id is 'ID de la cuenta en el proveedor. Para whatsapp_cloud es el phone_number_id de Meta (no el teléfono visible). Único por proveedor.';
comment on column public.conv_canales.waba_id is 'ID de la cuenta de WhatsApp Business (WABA) en Meta, si se conoce.';
comment on column public.conv_canales.display_phone is 'Teléfono visible del canal, solo para mostrar.';
comment on column public.conv_canales.status is 'connected (recibe), disabled (ignorado; valor inicial) o error. Sin secretos: los tokens van en variables de entorno.';

comment on table public.conv_contactos is
  '[CONVERSATIONS|preparado] Persona que habla con Nexo, global: un teléfono E.164 = un contacto en todo Conversations. Su pertenencia a empresas y restaurantes está en conv_contacto_empresas / conv_contacto_restaurantes. DENY BY DEFAULT: sin esas filas no tiene acceso a ningún dato (p. ej. un desconocido que escribe). Datos personales. ORIGEN: webhook de mensajes entrantes (servidor) o alta manual futura. USO: identifica quién escribe; base de permisos del bot, informes y alertas.';
comment on column public.conv_contactos.telefono_e164 is 'Teléfono normalizado E.164 (+34688718820), producido por lib/conversations/normalize-phone.ts. Único globalmente.';
comment on column public.conv_contactos.nombre is 'Nombre interno editable por Nexo (p. ej. José Ramón). Distinto de nombre_perfil. La interfaz muestra nombre; si no hay, nombre_perfil; si tampoco, el teléfono. Nunca lo sobrescribe el proveedor.';
comment on column public.conv_contactos.nombre_perfil is 'Nombre de perfil que declara el contacto en WhatsApp (p. ej. "JR 🍔"). Lo actualiza el webhook, puede cambiar y no es un nombre verificado.';
comment on column public.conv_contactos.external_contact_id is 'ID del contacto en el proveedor (wa_id de WhatsApp), si se conoce.';
comment on column public.conv_contactos.usuario_id is 'FK → auth.users.id. Usuario de Nexo que es esta persona, si lo es. SET NULL si se borra el usuario.';

comment on table public.conv_contacto_empresas is
  '[CONVERSATIONS|preparado] Empresas a las que pertenece una persona (una o varias). Es la autoridad sobre qué empresa puede consultar un contacto; nunca se deduce del texto de un mensaje. ORIGEN: administración (futura pantalla, servidor). USO: el bot y los permisos resuelven teléfono → contacto → empresas → restaurantes.';
comment on column public.conv_contacto_empresas.todos_restaurantes is 'true = acceso a todos los restaurantes actuales y futuros de la empresa; false (por defecto) = solo los relacionados explícitamente en conv_contacto_restaurantes.';

comment on table public.conv_contacto_restaurantes is
  '[CONVERSATIONS|preparado] Restaurantes concretos a los que tiene acceso una persona. Las claves compuestas garantizan en la base que la persona pertenece a esa empresa (conv_contacto_empresas) y que el restaurante es de esa empresa (restaurantes). ORIGEN: administración (futura pantalla, servidor). USO: alcance de datos del bot, informes y alertas.';
comment on column public.conv_contacto_restaurantes.empresa_id is 'Empresa del restaurante y de la autorización de la persona. Se guarda para que las claves compuestas verifiquen la coherencia; no es un dato independiente.';

comment on table public.conv_conversaciones is
  '[CONVERSATIONS|preparado] Chat entre el canal central y un contacto (uno por pareja canal+contacto; se reabre, no se duplica). Sin empresa: el acceso de la persona está en conv_contacto_*. Visibilidad inicial en la web: solo super_admin. ORIGEN: webhook de mensajes entrantes (servidor). USO: bandeja de conversaciones ordenada por último mensaje; padre de conv_mensajes.';
comment on column public.conv_conversaciones.estado is 'open o closed. No indica quién atiende (bot/humano): eso se añadirá con ese módulo.';
comment on column public.conv_conversaciones.ultimo_mensaje_at is 'provider_timestamp del mensaje más reciente (usar el mayor, no el último recibido). Orden de la bandeja. NULL si aún no hay mensajes.';
comment on column public.conv_conversaciones.ultimo_mensaje_preview is 'Vista previa corta (máx. 200 caracteres) del último mensaje, solo para la lista.';

comment on table public.conv_mensajes is
  '[CONVERSATIONS|preparado] HECHOS: cada mensaje de WhatsApp, entrante o saliente, con su estado de entrega y metadatos de medios (nunca binarios). Sin empresa: el tenant se resuelve por conversación → contacto → empresas. Contiene datos personales. ORIGEN: webhook de Meta (entrantes y estados) y envío desde Nexo (salientes), siempre vía servidor. USO: hilo de la conversación; unique (canal_id, external_id) hace idempotente el webhook.';
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
