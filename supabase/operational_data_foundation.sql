-- Nexo Origen · Base para datos operativos por restaurante (área OPERACIONES).
--
-- Objetivo: que cada restaurante pueda recibir, además de reseñas, tiempos de
-- Auto / Sala / Delivery, ventas, tickets, personal, costes… SIN crear una
-- tabla nueva por cada dato. Se separan cuatro conceptos (DATA_MODEL §24):
--
--   canales            → vocabulario   (Auto, Sala, Delivery, Para llevar, Total)
--   metricas_catalogo  → vocabulario   (qué se puede medir, en qué unidad)
--   restaurante_metricas → HECHOS      (un valor medido de un restaurante en un periodo)
--   objetivos          → CONFIGURACIÓN (qué valor queremos alcanzar, con vigencia)
--
-- Añadir un dato nuevo = una fila en metricas_catalogo (sin DDL). Las fuentes
-- externas (StoreAce, TPV, delivery…) se registran en restaurante_integraciones
-- (provider + external_ref) y sus datos entran en restaurante_metricas.
--
-- La reputación (rating, reseñas) NO se guarda aquí: su única fuente es
-- resenas → nexo_canonical_reviews. Aquí no debe haber una segunda copia.
--
-- Cambio aditivo: no toca tablas ni funciones existentes salvo añadir la columna
-- restaurantes.zona_horaria (default 'Europe/Madrid' = comportamiento actual).
--
-- Rollback:
--   drop table public.objetivos, public.restaurante_metricas,
--              public.metricas_catalogo, public.canales;
--   alter table public.restaurantes drop column zona_horaria;

-- 1) Zona horaria por restaurante (DATA_MODEL §18) ----------------------------
alter table public.restaurantes
  add column if not exists zona_horaria text not null default 'Europe/Madrid';

comment on column public.restaurantes.zona_horaria is
  'Zona horaria IANA del local (p. ej. Europe/Madrid). Define qué día/semana es "hoy" para sus datos operativos. Hoy todo el código asume Europe/Madrid; esta columna prepara locales en otros husos.';

-- 2) Canales -------------------------------------------------------------------
create table if not exists public.canales (
  clave       text primary key check (clave ~ '^[a-z][a-z0-9_]*$'),
  nombre      text not null,
  descripcion text,
  orden       smallint not null default 100,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.canales (clave, nombre, descripcion, orden) values
  ('total',    'Total',        'Todo el restaurante, sin separar por canal.',                 10),
  ('sala',     'Sala',         'Consumo dentro del local (comer allí).',                      20),
  ('auto',     'Auto',         'Servicio en coche / drive-thru.',                             30),
  ('delivery', 'Delivery',     'Entrega a domicilio (plataformas o propio).',                 40),
  ('takeaway', 'Para llevar',  'Recogida en mostrador sin consumir en el local.',             50)
on conflict (clave) do nothing;

-- 3) Catálogo de métricas -------------------------------------------------------
create table if not exists public.metricas_catalogo (
  clave       text primary key check (clave ~ '^[a-z][a-z0-9_]*$'),
  nombre      text not null,
  familia     text not null check (familia in ('tiempos','ventas','personal','costes','otros')),
  unidad      text not null check (unidad in ('segundos','importe','unidades','horas','porcentaje')),
  agregacion  text not null check (agregacion in ('suma','media','media_ponderada','ultimo')),
  mejor_si    text check (mejor_si in ('mayor','menor')),
  descripcion text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.metricas_catalogo (clave, nombre, familia, unidad, agregacion, mejor_si, descripcion) values
  ('tiempo_servicio', 'Tiempo de servicio', 'tiempos', 'segundos', 'media_ponderada', 'menor',
   'Segundos desde que el cliente pide hasta que recibe el pedido. El canal (auto/sala/delivery) distingue el tipo. Se pondera por muestras al agregar.'),
  ('ventas_netas',    'Ventas netas',       'ventas',  'importe',  'suma',            'mayor',
   'Importe vendido sin impuestos en el periodo. Requiere moneda en restaurante_metricas.moneda.'),
  ('tickets',         'Tickets',            'ventas',  'unidades', 'suma',            'mayor',
   'Número de tickets/pedidos cobrados. Ticket medio = ventas_netas / tickets (se calcula, no se guarda).')
on conflict (clave) do nothing;

-- 4) Hechos: métricas por restaurante -------------------------------------------
create table if not exists public.restaurante_metricas (
  id             bigint generated always as identity primary key,
  restaurante_id bigint not null
                 references public.restaurantes(id) on update cascade on delete restrict,
  metrica_clave  text not null
                 references public.metricas_catalogo(clave) on update cascade,
  canal_clave    text not null default 'total'
                 references public.canales(clave) on update cascade,
  periodo_inicio timestamptz not null,
  periodo_fin    timestamptz not null,
  valor          numeric not null,
  muestras       integer check (muestras is null or muestras >= 0),
  moneda         text check (moneda is null or moneda ~ '^[A-Z]{3}$'),
  fuente         text not null,
  fuente_ref     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (periodo_fin > periodo_inicio),
  -- Idempotencia: el mismo dato recibido dos veces se actualiza, no se duplica.
  unique (restaurante_id, metrica_clave, canal_clave, periodo_inicio, periodo_fin, fuente)
);

create index if not exists idx_restaurante_metricas_rest_metrica_periodo
  on public.restaurante_metricas (restaurante_id, metrica_clave, periodo_inicio desc);
create index if not exists idx_restaurante_metricas_metrica_periodo
  on public.restaurante_metricas (metrica_clave, periodo_inicio desc);
create index if not exists idx_restaurante_metricas_canal
  on public.restaurante_metricas (canal_clave);

-- 5) Configuración: objetivos con vigencia --------------------------------------
create table if not exists public.objetivos (
  id             bigint generated always as identity primary key,
  empresa_id     bigint references public.empresas(id)     on update cascade on delete cascade,
  marca_id       bigint references public.marcas(id)       on update cascade on delete cascade,
  restaurante_id bigint references public.restaurantes(id) on update cascade on delete cascade,
  metrica_clave  text not null
                 references public.metricas_catalogo(clave) on update cascade,
  canal_clave    text not null default 'total'
                 references public.canales(clave) on update cascade,
  valor          numeric not null,
  vigente_desde  date not null,
  vigente_hasta  date,
  notas          text,
  created_at     timestamptz not null default now(),
  -- El objetivo pertenece a UN nivel: empresa, marca o restaurante.
  check (num_nonnulls(empresa_id, marca_id, restaurante_id) = 1),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

create index if not exists idx_objetivos_empresa     on public.objetivos (empresa_id)     where empresa_id is not null;
create index if not exists idx_objetivos_marca       on public.objetivos (marca_id)       where marca_id is not null;
create index if not exists idx_objetivos_restaurante on public.objetivos (restaurante_id) where restaurante_id is not null;
create index if not exists idx_objetivos_metrica     on public.objetivos (metrica_clave, canal_clave);

-- 6) Seguridad: solo servidor (service role). RLS activo sin políticas. ---------
alter table public.canales              enable row level security;
alter table public.metricas_catalogo    enable row level security;
alter table public.restaurante_metricas enable row level security;
alter table public.objetivos            enable row level security;

revoke all on public.canales, public.metricas_catalogo,
              public.restaurante_metricas, public.objetivos
  from anon, authenticated;

-- 7) Documentación visible en Supabase ------------------------------------------
comment on table public.canales is
  '[OPERACIONES|preparado] Catálogo de canales de venta/servicio: total, sala, auto, delivery, takeaway. ORIGEN: alta manual (migración). USO: dimensión de restaurante_metricas y objetivos; cada proveedor externo se traduce a un canal interno (p. ej. StoreAce "DINE_IN" → sala). Añadir un canal = insertar una fila.';
comment on column public.canales.clave is 'Identificador estable en minúsculas (total, sala, auto, delivery, takeaway). No renombrar: lo referencian los datos.';
comment on column public.canales.orden is 'Orden de aparición en pantallas (menor primero).';

comment on table public.metricas_catalogo is
  '[OPERACIONES|preparado] Catálogo de lo que Nexo puede medir por restaurante (tiempo de servicio, ventas, tickets… y lo que se añada). Define unidad, cómo se agrega y si mejor es mayor o menor. ORIGEN: alta manual (migración). USO: restaurante_metricas y objetivos apuntan aquí; la interfaz y el Brain leen unidad/agregación de aquí en lugar de hardcodearla. NO incluye reputación (esa vive en resenas).';
comment on column public.metricas_catalogo.clave is 'Identificador estable (tiempo_servicio, ventas_netas, tickets…).';
comment on column public.metricas_catalogo.familia is 'Agrupación: tiempos, ventas, personal, costes, otros.';
comment on column public.metricas_catalogo.unidad is 'Unidad interna única: segundos, importe, unidades, horas, porcentaje. La pantalla puede formatear (p. ej. mm:ss) pero no cambia la unidad guardada.';
comment on column public.metricas_catalogo.agregacion is 'Cómo se combinan varios periodos: suma, media, media_ponderada (por muestras) o ultimo.';
comment on column public.metricas_catalogo.mejor_si is 'Sentido de mejora: menor (tiempos, costes) o mayor (ventas, rating).';

comment on table public.restaurante_metricas is
  '[OPERACIONES|preparado] HECHOS operativos por restaurante: un valor medido de una métrica, en un canal y un periodo (tiempos Auto/Sala/Delivery, ventas, tickets, personal, costes…). Vacía hasta conectar la primera fuente. ORIGEN: ingestas de proveedores (StoreAce/TPV/delivery/manual) vía servidor; proveedor registrado en restaurante_integraciones. USO: Domain calcula KPIs y comparativas; el Brain los interpreta. Guardar siempre el dato más granular fiable y no porcentajes sueltos.';
comment on column public.restaurante_metricas.restaurante_id is 'FK → restaurantes.id. De aquí se resuelve empresa y marca (aislamiento por tenant). ON DELETE RESTRICT: no se borra histórico operativo por accidente.';
comment on column public.restaurante_metricas.metrica_clave is 'FK → metricas_catalogo.clave. Qué se mide.';
comment on column public.restaurante_metricas.canal_clave is 'FK → canales.clave. total = todo el local sin separar.';
comment on column public.restaurante_metricas.periodo_inicio is 'Inicio del intervalo medido (incluido). timestamptz; el día de negocio se calcula con restaurantes.zona_horaria.';
comment on column public.restaurante_metricas.periodo_fin is 'Fin del intervalo medido (excluido). Debe ser > periodo_inicio.';
comment on column public.restaurante_metricas.valor is 'Valor en la unidad de metricas_catalogo.unidad (segundos, importe, unidades…). Sin formatear.';
comment on column public.restaurante_metricas.muestras is 'Nº de observaciones detrás del valor (pedidos, tickets…). Permite ponderar medias al agregar.';
comment on column public.restaurante_metricas.moneda is 'ISO-4217 (EUR). Solo para métricas de unidad importe; NULL en el resto.';
comment on column public.restaurante_metricas.fuente is 'Proveedor u origen del dato (storeace, tpv, manual…). Forma parte de la clave única.';
comment on column public.restaurante_metricas.fuente_ref is 'Referencia opcional a la ingesta/lote/archivo de origen, para auditar y reprocesar.';
comment on column public.restaurante_metricas.updated_at is 'Última vez que la ingesta reescribió el dato (upsert por la clave única).';

comment on table public.objetivos is
  '[OPERACIONES|preparado] Objetivos con vigencia temporal por empresa, marca o restaurante y métrica/canal (p. ej. tiempo_servicio en auto = 150 s). Vacía: hoy el objetivo de rating sigue en marcas.objetivo_media. ORIGEN: configuración manual desde administración. USO: comparar restaurante_metricas frente a meta. Regla de lectura: el nivel más específico (restaurante > marca > empresa) con vigente_desde ≤ fecha ≤ vigente_hasta (o sin fin).';
comment on column public.objetivos.empresa_id is 'Nivel del objetivo: exactamente UNO de empresa_id / marca_id / restaurante_id debe estar informado.';
comment on column public.objetivos.metrica_clave is 'FK → metricas_catalogo.clave.';
comment on column public.objetivos.canal_clave is 'FK → canales.clave. total = objetivo global del local.';
comment on column public.objetivos.valor is 'Valor objetivo en la unidad de la métrica.';
comment on column public.objetivos.vigente_desde is 'Primer día en que aplica.';
comment on column public.objetivos.vigente_hasta is 'Último día en que aplica; NULL = vigente sin fecha de fin.';
