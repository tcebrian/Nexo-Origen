# Estado del proyecto — Nexo Origen

**Última actualización:** 2026-08-09. Léelo entero antes de seguir trabajando —
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

1. **Retomar Fase 0** donde se dejó: construir `<KpiStrip>`, extraer el patrón
   `divide-y` como token reutilizable, confirmar la regla de radios.
2. Verificar `<PageHeader>` visualmente (crear una página de prueba temporal sin auth,
   como se ha hecho antes con `RestaurantesCard`, o esperar a Fase 2 para verlo ya
   integrado en Inicio).
3. Seguir con Fase 1 (App Shell — solo verificación) y Fase 2 (Dashboard) una vez Fase
   0 esté cerrada y aprobada.
