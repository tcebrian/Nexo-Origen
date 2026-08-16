# Estado del proyecto — Nexo Origen

**Última actualización:** 2026-08-15. Léelo entero antes de seguir trabajando —
sustituye a "contexto perdido" al cambiar de conversación o de ordenador.

## ⚠️ Importante antes de nada

- **Todo lo de este archivo ya está commiteado y pusheado a `origin/main`** en
  `https://github.com/tcebrian/Nexo-Origen.git` (repo privado). Si trabajas desde otro
  ordenador: `git clone` (o `git pull` si ya lo tenías clonado), no hace falta recuperar
  nada más de este.
- **`.env.local` NO está en git** (correcto, así debe ser — tiene credenciales reales de
  Supabase). En un ordenador nuevo hay que **copiarlo a mano** desde el ordenador
  original o desde donde lo tengas guardado — sin él la app no arranca. Contiene URL,
  anon key, service role key de Supabase y `NEXT_PUBLIC_DATA_SCOPING_ENABLED=true`.
- Tras clonar: `npm install`, copiar `.env.local`, luego `npm run typecheck && npm run
  build` para confirmar que todo arranca limpio antes de seguir.
- Servidor de pruebas: `.claude/launch.json` ya configurado (`nexo-origen-dev`, puerto
  3000) — usar `preview_start` con ese nombre, no `npm run dev` por Bash.
- La auditoría de arquitectura visual completa (ver más abajo) vive también como
  Artifact en claude.ai — accesible desde cualquier ordenador con el mismo login, no
  depende de este repo ni de este ordenador:
  `https://claude.ai/code/artifact/9b416d4c-9a10-401b-9990-9a1e62cd41f4`. La copia local
  (`Auditoria-Nexo-Origen.html` en el escritorio) es solo para verla sin conexión.

## Skills de diseño activas (se disparan solas, no hay que invocarlas)

- **`.claude/skills/nexo-design/SKILL.md`** — acabado visual de componentes: tokens,
  motion, tipografía, verificación obligatoria tras cualquier cambio.
- **`.claude/skills/nexo-saas-system/SKILL.md`** (nueva) — arquitectura visual a nivel
  de producto: cuándo algo debe ser tarjeta vs. tabla/lista/grid, evita el patrón
  "card soup". Se aplica **antes** que `nexo-design` en cualquier rediseño de sección
  completa (decide estructura primero, `nexo-design` pule después). Fundamentada con
  cifras reales del propio código (151 superficies tipo tarjeta en el dashboard, etc.),
  no con opiniones.

## Qué se hizo en la sesión del 2026-08-15 (ordenador nuevo, sin Node.js ni `.env.local`)

Este ordenador no tenía Node.js instalado (ni el proyecto tenía `node_modules`) — se
instaló Node.js LTS (v24.19.0) vía `winget`, y `npm install` (limpio, tras borrar un
primer intento que quedó a medias por un `EPERM` de red — `node_modules` está en
`.gitignore`, se pudo borrar sin riesgo). **`.env.local` sigue sin copiarse a este
ordenador** — la app no arranca en local todavía, pendiente de traerlo del ordenador
original o de donde esté guardado (ver más abajo).

Retomada Fase 0 donde se dejó:

1. **`<KpiStrip>`** (`app/dashboard/_components/kpi-strip.tsx`, nuevo) — reemplaza el
   patrón de "4 tarjetas independientes para una fila de KPIs relacionados" señalado
   como card soup en `nexo-saas-system` (ejemplos reales: `RestaurantesStatusSummary`,
   `AlertasSummary`, `ResenasSummary`, `PreventNetworkSummary`, `TalentoSummaryBar`, cada
   una con su propio `SummaryCard`/`Card` local casi idéntico). Es **una sola superficie**
   con divisores internos en vez de N tarjetas con borde+sombra propios: apilada con
   divisor horizontal en móvil, fila con divisor vertical en escritorio (corte `lg`, el
   único de la app). Igual que se hizo con `<PageHeader>` en la sesión anterior, **se ha
   construido pero no se ha conectado a ninguna página todavía** — la integración pasa
   sección por sección en las Fases 2–8 (Dashboard, Restaurantes, Reseñas, Alertas, Nexo
   Prevent, Talento), no de golpe en Fase 0.
2. **Token `listSurface`** en `app/dashboard/_components/ui/nexo-styles.ts` — extrae el
   patrón `divide-y` que ya existía escrito a mano en `alertas-inbox.tsx` (única sección
   que ya lo usaba) como export reutilizable. `alertas-inbox.tsx` ya se ha migrado a
   usarlo (mismas clases exactas, cero cambio visual, verificado por build).
3. **Regla de radios confirmada y aplicada** en las dos piezas nuevas de este punto:
   `rounded-[var(--nexo-radius)]` (12px) para superficies compactas/listas,
   `rounded-[var(--nexo-radius-lg)]` (16px) para superficies tipo tarjeta más prominentes
   — documentado en un comentario junto a `listSurface`, en vez de seguir usando
   `rounded-xl`/`rounded-2xl` sueltos en código nuevo. **No se ha tocado código
   existente** (fuera de `alertas-inbox.tsx`, que ya usaba exactamente ese radio) — la
   limpieza del resto del código con radios sueltos queda para cuando se toque cada
   sección en sus fases correspondientes, igual que el resto de deuda visual.
4. **Verificado, incluida verificación visual**: `npm run typecheck` limpio (0 errores),
   `npm run lint` con las mismas 35 warnings preexistentes de siempre (0 nuevas),
   `npm run build` limpio. `.env.local` recreado en este ordenador (URL y `anon key`
   sacadas por API de Supabase — MCP conectado a `tcebrian's Project`/
   `tsbkcaxbgzfnpqmihabb` — la `service_role` no se puede leer por API, la pegó el
   usuario a mano). Verificación visual hecha con una página temporal sin auth
   (`app/preview/fase-0/page.tsx`, **creada y borrada en la misma sesión**, patrón ya
   usado antes con `RestaurantesCard` — cualquier ruta fuera de `/dashboard`/`/api`
   esquiva el middleware de auth) montando `<PageHeader>`, `<KpiStrip>` (con estado
   activo/clic y skeleton de carga) y `AlertasInbox` con datos de ejemplo, comprobada a
   375px y 1280px por DOM/JS (`getComputedStyle`: `flex-direction` cambia
   column/row en el corte `lg`, el divisor pasa de `border-bottom` a `border-right`
   excluyendo siempre el último item, colores y radios correctos) sin errores de
   consola ni de servidor.

## Qué se hizo en la sesión del 2026-08-15 (continuación: Fase 1 y Fase 2)

Misma sesión que la anterior, continuando el plan de 9 fases tras cerrar Fase 0.

**Fase 1 (App Shell) — verificada, sin cambios.** `dashboard-shell.tsx` ya cumplía la
estructura definida (sidebar 250px en escritorio, barra superior 49px + barra inferior
en móvil con hasta 4 iconos + "Más"). No se detectó nada que corregir.

**Fase 2 (Dashboard/Inicio) — `<PageHeader>` y `<KpiStrip>` conectados de verdad por
primera vez:**

1. **`dashboard-home-view.tsx`** (`NetworkDashboardHomeView`, la vista de red que ven
   super_admin/empresa_admin/marca_admin con más de un restaurante): la cabecera de
   saludo a mano → `<PageHeader>` (título = saludo, subtítulo = resumen, acción = pastilla
   de periodo). Las 4 tarjetas `KpiCard` sueltas (Media global / Reseñas este mes /
   Reseñas negativas / Restaurantes) → `<KpiStrip>`, con `tone` por KPI (antes el color
   solo lo llevaba el texto de ayuda pequeño, ahora lo lleva la cifra grande — igual que
   ya hacían `RestaurantesStatusSummary`/`AlertasSummary`/etc., más consistente entre
   secciones) e icono en `topRight`. **No se tocó `kpi.tsx`/`KpiCard`** — ese componente
   lo sigue usando `restaurantes-brand-kpis.tsx` (Fase 3, fuera de alcance hoy); los
   iconos se reimplementaron localmente en `dashboard-home-view.tsx` en vez de tocar un
   componente compartido usado fuera de esta fase.
2. **`restaurant-user-home-view.tsx`** (`RestaurantUserHomeView`, la vista compacta para
   perfiles de un solo restaurante, también servida en `/dashboard`): **solo la cabecera
   de escritorio** (la de `hidden lg:flex`, la móvil es un hero card distinto y no se ha
   tocado) migrada a `<PageHeader>` igual que la de arriba. **La rejilla de 4 tarjetas KPI
   de esta vista (Media actual/Estado/Reseñas del periodo/Alertas activas) NO se migró a
   `<KpiStrip>`** — a diferencia de las de Inicio, cada una tiene contenido heterogéneo
   (barra de progreso, sparkline, badge de estado) que no encaja en el `label/value/hint`
   genérico de `KpiStrip` sin forzarlo; queda pendiente para cuando se rediseñe esta vista
   con más calma, no es un simple mapeo de props.
3. **Verificado**: `typecheck`/`lint` (35 warnings preexistentes, 0 nuevas)/`build`
   limpios. Verificación visual con dos páginas temporales sin auth más (mismo patrón que
   Fase 0, creadas y borradas en la sesión): confirmado por DOM/JS que `<AnimatedNumber>`
   anidado dentro del `value` de `KpiStrip` hereda color/fuente/tamaño correctamente sin
   necesitar `className` propio, que los tonos por KPI pintan el color correcto
   (`--nexo-success`/`-critical`/`-text`), y que ambas cabeceras cambian de columna a fila
   en el corte `lg` sin desbordar en 375px ni 1280px. Dos artefactos del entorno de
   pruebas (no bugs reales, confirmados por `document.hidden === true` en la pestaña de
   test): `<AnimatedNumber>` se queda en 0 porque Chrome pausa `requestAnimationFrame` en
   pestañas ocultas, y el logo de `BrandMark` (`loading="lazy"`) no decodifica porque el
   lazy-loading nativo tampoco corre en pestañas ocultas — en la app real, con la pestaña
   visible, ambos funcionan con normalidad.

## Qué se hizo en la sesión de rediseño estructural (2026-08-09)

Aplicando ambas skills juntas, con aprobación explícita del usuario en cada paso:

1. **Auditoría de arquitectura visual completa** de las 7 secciones (Inicio,
   Restaurantes, ficha de restaurante, Reseñas, Alertas, Nexo Prevent, Informes) +
   navegación, en desktop/tablet/móvil. Primero por lectura de código (6 agentes de
   exploración en paralelo), después **verificada en vivo** con sesión real
   (super_admin, Grupo Hámbar, datos de producción) a 375/768/1024/1280px. Documento
   completo: `Auditoria-Nexo-Origen.html` (escritorio) / Artifact (enlace arriba).
   Incluye: los 20 puntos de análisis pedidos, un design system global conceptual, qué
   componentes eliminar/fusionar/mantener, y un plan de rediseño por fases.
2. **P0 — Restaurantes, tarjeta móvil** (ya en producción): el listado de red en móvil
   usaba una tabla con scroll horizontal forzado sin alternativa. Se activó
   `RestaurantesCard` (existía sin usar) con evolución/tendencia real (`trend`,
   `sparkline`, ya calculados, antes sin pintar), microcopy "Cerca del objetivo" /
   "Necesita atención" para vigilancia/riesgo manteniendo los estados oficiales
   intactos, tarjeta entera pulsable. Archivos: `restaurantes-card.tsx`,
   `restaurantes-page.tsx`, `restaurantes-styles.ts` (añadido `cardOnTarget`).
   Desktop sin tocar (`hidden lg:block` / `lg:hidden`).
3. **Dos hotfixes independientes** (fuera del orden de fases, ya implementados y
   verificados con build/typecheck limpios):
   - **Nexo Prevent**: la tabla de restaurantes tenía el mismo problema que Restaurantes
     antes de P0 (scroll horizontal forzado, `min-w-[880px]`, sin alternativa en
     móvil — confirmado en vivo que las columnas "Acción necesaria"/"Ver estrategia"
     quedaban completamente invisibles). Añadida lista móvil propia
     (`PreventMobileRow` en `prevent-restaurant-table.tsx`), con su propia composición
     de fila (no la tarjeta de Restaurantes reutilizada — cada sección compone la suya).
   - **Alertas**: bug real de UI rota encontrado en la verificación visual (no era
     visible por lectura de código) — el nombre del restaurante en "Tu prioridad #1" se
     solapaba con la media del local en escritorio (≥1024px). Causa: un contenedor de
     texto sin `flex-1` dentro de una fila `flex nowrap` colapsaba a `width:0` y el
     texto se envolvía carácter a carácter. Mismo tipo de bug que en P0. Arreglado en
     `alertas-priority-hero.tsx` sustituyendo `RestaurantBrandLine` (modo "inline") por
     un bloque manual `BrandMark` + `min-w-0 flex-1`.
   - **Nota para el futuro**: este es ya el **segundo** sitio donde aparece este bug
     (el primero fue en P0, antes de arreglarse ahí también). Es un candidato claro a
     revisar de forma centralizada en `RestaurantBrandLine`
     (`app/dashboard/_components/restaurant-brand-line.tsx`, modo `layout="inline"` —
     su div interno de texto no tiene `flex-1`/ancho garantizado) durante Fase 0 o Fase
     9, en vez de seguir parcheando cada sitio donde reaparezca uno a uno. **No se ha
     tocado el componente compartido todavía** — cada bug se arregló localmente en el
     sitio donde apareció, para no arriesgar los 24 archivos que lo usan.
4. **Plan de fases aprobado** (sustituye cualquier orden anterior):
   Fase 0 Design System → 1 App Shell/estructura base → 2 Dashboard → 3 Restaurantes →
   4 Reseñas → 5 Ficha de restaurante → 6 Nexo Prevent → 7 Alertas → 8 Informes →
   9 refinamiento transversal. Decisiones ya tomadas: el código muerto (~17 archivos,
   ~1.100 líneas, listados en el documento de auditoría) se retira **progresivamente
   dentro de cada fase**, no de golpe; no habrá un `<DataTable>` con fallback móvil
   automático — cada sección compone su propia estructura de lista/tarjeta móvil según
   sus datos (ya demostrado en Restaurantes P0 y en el hotfix de Nexo Prevent).
5. **Fase 0 — EN CURSO, sin terminar.** Solo se ha creado
   `app/dashboard/_components/page-header.tsx` (`<PageHeader>`: kicker opcional +
   título único de 28px/lg:32px para toda la app — se eligió ese tamaño porque ya era
   el que seguían más secciones, en vez del token `textPageTitle` existente de
   30px/lg:34px que casi nadie usaba realmente). **Typecheck y build verificados
   limpios, pero el componente todavía no se usa en ninguna página** (cero cambios
   visibles, tal como pedía el plan). **Falta**: `<KpiStrip>` (sustituye ~5
   implementaciones sueltas de "tira de 4 KPIs"), formalizar el token de lista
   `divide-y` (patrón ya real en `alertas-inbox.tsx`, falta extraerlo como export
   reutilizable), y confirmar la regla de radios reducida (ya hay tokens
   `--nexo-radius`/`-lg` = 12px/16px en `globals.css`, solo falta la disciplina de
   dejar de usar `rounded-lg`/`rounded-md`/valores sueltos entre paréntesis para lo
   mismo). El usuario interrumpió aquí ("espera") para pedir que se guardara todo antes
   de cambiar de ordenador — **retomar Fase 0 exactamente desde este punto**.
6. **Hallazgo nuevo, no crítico, para revisar en algún momento**: hay dos sistemas de
   color en paralelo — el archivo global `app/dashboard/_components/ui/nexo-styles.ts`
   (usado por Inicio, Alertas, Nexo Prevent, Informes, Reseñas) usa clases Tailwind
   fijas (`text-white`, `text-gray-400`...), mientras que
   `app/dashboard/restaurantes/_components/ui/restaurantes-styles.ts` (más reciente) usa
   las variables CSS `--nexo-text`/`-secondary`/`-tertiary` de `globals.css`. Los
   componentes nuevos de Fase 0 (`PageHeader`) ya usan las variables CSS — es la
   dirección a seguir, pero no se ha tocado nada existente todavía.

## Qué se hizo en la sesión anterior (2026-08-08, ya commiteado)

Commit `53960cf` — robustez/seguridad (cliente Supabase perezoso, error boundaries,
middleware fail-closed), onboarding de Vault Burger SL como segundo tenant aislado,
rediseño móvil del shell y del selector de fechas, vista compacta de un solo
restaurante (`RestaurantUserHomeView`), y la skill `nexo-design` original. Detalle
completo en el historial de git (`git log`, `git show 53960cf`) — no se repite aquí.

## Decisiones de diseño a recordar

- Un perfil se trata como "de un solo restaurante" por **tener un único restaurante en
  su scope**, no por su rol.
- Media de Google y Media del periodo se muestran **siempre juntas y diferenciadas**.
- Mobile y desktop son dos flujos JSX separados (`lg:hidden` / `hidden lg:...`), nunca
  un único layout que se encoge — `lg` (1024px) es el único corte estructural real de
  toda la app.
- **Card soup**: antes de envolver un dato en `rounded-xl/2xl border`, preguntar si de
  verdad es una entidad independiente (tarjeta) o parte de un grupo (tabla/lista/grid
  tipográfico). Ver `nexo-saas-system` para el criterio completo.
- El morado (`--nexo-accent`) es acento puntual, no decoración constante — evitar glow
  y `backdrop-blur` salvo que aporten jerarquía real.

## Cosas que NO se deben tocar sin que el usuario lo pida explícitamente

- `lib/auth/**` (permisos, scopes, sesión).
- Esquema de Supabase (tablas/columnas reales).
- La vulnerabilidad de `uuid`/`exceljs` — dejada así a propósito (downgrade sería peor).
- `RestaurantBrandLine` compartido (`app/dashboard/_components/restaurant-brand-line.tsx`)
  — tiene un bug conocido en modo `layout="inline"` (ver punto 3 arriba), pero tocarlo
  afecta a 24 archivos; se ha decidido parchear cada sitio localmente hasta que se
  aborde de forma centralizada y deliberada.

## Pendiente / no resuelto todavía

1. **No existe pantalla de "recuperar/crear contraseña"**.
2. **RLS de Supabase permisivo** (`USING (true)`) — aislamiento real solo a nivel de app.
3. **Botón "Responder" a reseñas**: solo visual, sin backend.
4. **`bksoria` (BK Soria)**: `media_google` sigue `null` (falta el dato en origen).
5. No se pudo instalar el plugin `frontend-design` de Anthropic (sin CLI `claude` ni
   conector MCP disponible en este entorno).
6. Warnings de ESLint preexistentes (35, no bloquean nada).
7. **Reseñas, hallazgo de la verificación en vivo**: con datos reales son 201 reseñas
   sin paginar/virtualizar en el inbox (53.000px de scroll) — más allá del rediseño
   visual (Fase 4), puede hacer falta paginar o virtualizar por rendimiento, no solo
   por diseño.
8. `RestaurantBrandLine` en modo inline — bug de colapso a `width:0`, candidato a
   arreglo centralizado (ver arriba).

## Próximos pasos inmediatos

1. **Fase 0, 1 y 2 cerradas** (ver sesión 2026-08-15 arriba). `.env.local` completo en
   este ordenador, `<PageHeader>`/`<KpiStrip>` construidos y ya conectados de verdad en
   Inicio (ambas variantes: red y de un solo restaurante).
2. Seguir con **Fase 3 (Restaurantes)**: candidato claro es migrar
   `restaurantes-brand-kpis.tsx` (usa `KpiCard`, mismo patrón de card soup) a
   `<KpiStrip>` — ahí sí habría que decidir qué hacer con `kpi.tsx`/`KpiCard` (dejarlo
   para otros usos futuros o retirarlo si esa migración lo deja sin uso).
3. **Pendiente aparte, no bloqueante**: la rejilla de 4 KPI de
   `restaurant-user-home-view.tsx` (Media actual/Estado/Reseñas del periodo/Alertas
   activas) no se migró a `<KpiStrip>` — contenido demasiado heterogéneo (barra de
   progreso, sparkline, badge) para el `label/value/hint` genérico. Revisar con más
   calma si se rediseña esa vista a fondo.
4. Servidor de pruebas: ojo, `.claude/launch.json` para `preview_start` está ahora en
   `C:\Users\Usuario\Desktop\tomas nexo origen\.claude\launch.json` (un nivel por
   encima del repo, porque el directorio de trabajo de esta sesión era ese nivel), con
   `npm --prefix Nexo-Origen run dev` — no en `Nexo-Origen\.claude\launch.json` (ese
   sigue existiendo pero no es el que se usa desde ese directorio de trabajo).
