# Estado del proyecto — Nexo Origen

**Última actualización:** 2026-08-18. Léelo entero antes de seguir trabajando —
sustituye a "contexto perdido" al cambiar de conversación o de ordenador.

## 🆕 Sesión 2026-08-18 — Plantilla PNG de reseña negativa por marca (Burger King)

Petición del usuario: en Informes, al pulsar "Generar imagen" en una reseña negativa,
quiere un diseño **único por marca** (no la plantilla genérica actual), empezando por
Burger King, calcando una dirección de arte muy concreta que el usuario fue afinando
en varias iteraciones ("paso a paso"). **Todo commiteado y pusheado**, verificado con
typecheck/lint/build limpios en cada paso — pero **sin verificación visual mía
directa**: el navegador de pruebas no pudo hacer capturas durante casi toda la sesión
("Screenshot timed out... Browser pane is not displayed"), así que todo se verificó por
(1) medición del DOM (overflow, solapamientos, posiciones) y (2) el propio usuario
mirando `localhost:3000/preview/negative-review-alert` y dando feedback iterativo. Una
vez, hacia el final, el usuario compartió el PNG real que él mismo descargó — eso
permitió encontrar y arreglar 2 bugs reales que la medición del DOM no había detectado
(ver más abajo). **Recomendación fuerte para la próxima sesión: en cuanto se pueda,
pedir al usuario un PNG fresco (botón "PNG navegador" en la página de preview) para
confirmar el estado visual actual antes de seguir iterando a ciegas.**

### Arquitectura nueva (dónde está cada cosa)

- `templates/negative-review-alert/brands/burger-king-alert-template.tsx` — componente
  React de la plantilla BK (nuevo).
- `templates/negative-review-alert/brands/burger-king-alert.css` — su CSS dedicado
  (nuevo, independiente del `negative-review-alert.css` genérico).
- `templates/negative-review-alert/brands/burger-king-alert-icons.tsx` — iconos propios
  en `currentColor` (nuevo; los iconos compartidos de `icons.tsx` tienen colores morado
  Nexo hardcodeados en el SVG, no sirven para una plantilla de marca BK).
- `public/design/burger-king/` — `bk-burger.png`, `bk-drink.png`, `bk-fries.png` (fotos
  reales que pasó el usuario, con fondo transparente), `bk-logo.png` (logo BK que pasó
  el usuario, sustituye al `brand_logo_url` genérico **solo dentro de esta plantilla**,
  sin tocar el logo que usa el resto de la app).
- **Selector de plantilla por marca**: `getNegativeReviewTemplate(brand)` en
  `lib/reports/negative-reviews/templates/index.ts` — devuelve `BurgerKingAlertTemplate`
  si `brand === "bk"`, si no la plantilla genérica. **Este selector existía ya antes de
  esta sesión pero no lo usaba nadie** (siempre devolvía la genérica) — ahora sí está
  conectado de verdad en:
  - `app/dashboard/informes/_components/informes-negative-reviews-image-modal.tsx` —
    **el modal real que se abre al pulsar "Generar imagen" en Informes** (usa
    `html-to-image` en el navegador, sin Playwright, sin necesitar login especial).
  - `app/templates/negative-review-alert/page.tsx` — la página que captura Playwright
    en el flujo servidor (`/api/generate-negative-review-image`, usado por el botón
    "PNG API" del preview). **Playwright no tiene el binario de Chromium instalado en
    este ordenador** (`chrome-headless-shell.exe` no existe) — ese botón falla aquí con
    un error claro (no es un bug de código); si hace falta, `npx playwright install
    chromium` lo arregla. El botón "PNG navegador" (html-to-image, sin Playwright) es
    el que sí funciona siempre y el que se ha usado para verificar toda la sesión.
  - `lib/templates/negative-review-alert/render-html.ts` — también actualizado por
    consistencia, pero es **código muerto** (nadie lo importa, confirmado por grep) —
    no afecta a nada real, no hace falta mantenerlo si estorba en el futuro.
- **Datos nuevos añadidos** (reales, de Supabase, no inventados):
  - `NegativeReviewAlertData.main_motive` ← `analisis_ia.motivo` (ya se calculaba como
    `NegativeReviewReportRow.motive`, solo faltaba propagarlo hasta la plantilla).
  - `NegativeReviewAlertData.detected_impact` ← `analisis_ia.impacto` (ya existía como
    `NegativeReviewReportRow.impactText`, solo faltaba propagarlo).
  - `NegativeReviewAlertData.employee_mentioned` ← `analisis_ia.empleado_mencionado`
    (esto sí era nuevo de verdad: no existía en `NegativeReviewReportRow`, se añadió el
    campo `employeeMentioned` en `lib/reports/negative-reviews/types.ts` +
    `build-rows.ts`).
  - `NegativeReviewReportRow.restauranteId` (nuevo) — necesario para la consulta de
    contexto semanal (ver abajo).
- **Contexto semanal — construido pero NO conectado todavía a la plantilla visual**:
  `lib/reports/negative-reviews/weekly-context.ts` (`computeWeeklyContext`) compara la
  semana natural (lunes–domingo) de la reseña con la semana anterior para el mismo
  restaurante (consulta nueva a Supabase, reutiliza `fetchResenasForPeriodServer`).
  Endpoint: `GET /api/informes/weekly-context?restauranteId=X&reviewDate=ISO`. **La
  plantilla actual usa un "Contexto del periodo" más simple** (periodo/núm.
  reseñas/objetivo/diferencia, sin el desglose semanal antes/después) porque el
  briefing final del usuario para el rediseño completo no pedía ese desglose — el
  cálculo semanal queda listo por si se retoma en el futuro, no se ha borrado.

### Bugs reales encontrados (no obvios, solo visibles con el PNG real)

1. **Fondo gris apagado en vez de crema cálido** — una capa de "grano de papel" (SVG
   `feTurbulence` con `mix-blend-mode: multiply`) oscurecía todo el lienzo por un
   cálculo de opacidad/color mal ajustado. **Solución: se quitó por completo** (clase
   `.bka-texture` y su `<div>` en el componente) — mejor sin textura que con una rota.
   Si en el futuro se quiere textura de papel, probar con un enfoque distinto (imagen
   real de textura muy tenue, no SVG generado a ciegas) y verificar con un PNG real
   antes de darlo por bueno.
2. **Hueco vacío enorme encima del comentario de la reseña** — `.bka-body` era una fila
   de grid `1fr` que forzaba a `.bka-review`/`.bka-insights` a estirarse a toda la
   altura disponible, y `.bka-quote` tenía `flex:1; justify-content:center`, así que el
   texto quedaba centrado con mucho aire vacío alrededor. **Solución**: las filas del
   `.bka-sheet` pasaron a `auto auto 1fr auto` (header/body/**row3**/footer) — ahora es
   la fila de paneles inferiores (Incidencias/Impacto/Contexto) la que absorbe el
   espacio sobrante (con su contenido centrado verticalmente), no la reseña. Verificado
   por DOM que el hueco muerto bajo el pie de página se redujo de ~227px a ~26px
   (exactamente el padding inferior del lienzo, no un hueco real).

### Iteraciones de tamaño (pedidas explícitamente, "paso a paso")

"RESEÑA NEGATIVA" del header y el logo de Nexo Origen se agrandaron varias veces a
petición del usuario (cada vez verificado sin overflow real por DOM): título ~19px→24
→42→50px, "NEGATIVA" ~32px→46→82→100px (con sombra de texto en 3 capas para dar
volumen, no plano), logo Nexo ~30px→44→78→95px de icono. "RESEÑA" además se hizo más
fina (font-weight 800→600) manteniendo "NEGATIVA" en negrita — si se sigue agrandando
en el futuro, recordar que las columnas del grid del header (`grid-template-columns`)
se han ido ajustando a mano cada vez para que quepa sin romper el nombre del
restaurante (que ahora tiene `text-overflow: ellipsis` de seguridad, no se rompe si el
hueco se aprieta).

### Qué falta / próximos pasos sugeridos

1. **Pedir un PNG fresco al usuario cuanto antes** para confirmar visualmente el estado
   tras los últimos cambios (logo nuevo, fondo arreglado, hueco arreglado) — todo lo de
   esta sesión se verificó por DOM + descripción, con solo 1 confirmación visual real a
   mitad de sesión.
2. Revisar si el resto de paneles (Diagnóstico IA, Análisis IA, fila de 3 paneles)
   también se ven bien ahora que `.bka-body` ya no se estira artificialmente — no se
   pudo re-confirmar con un PNG real tras el último arreglo del hueco vacío.
3. Decidir si se quiere retomar el contexto semanal (`weekly-context.ts`, ya construido
   y verificado con typecheck) en la plantilla, o dejarlo tal cual está la versión
   simplificada.
4. Extender el mismo patrón (plantilla propia + selector por `brand`) a otras marcas
   cuando se pida — de momento solo Burger King tiene diseño propio, el resto sigue
   usando la plantilla genérica morada.
5. Si se retoma Fase 0/1/2 del rediseño estructural general (ver sesiones anteriores
   abajo), seguía exactamente donde se dejó el 17/08 — esta sesión del 18/08 fue un
   desvío para atender la petición explícita de la plantilla PNG, no ha tocado nada de
   `PageHeader`/`KpiStrip`/Fase 0.

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

## Qué se hizo en la sesión del 2026-08-16/17 (mismo ordenador que la del 2026-08-15)

Tres piezas, todas ya commiteadas y pusheadas (`c8ea6aa`, luego revert `dd5c277` de un
intento de Fase 2, luego `c3db909`):

1. **Intento de Fase 2 (Dashboard) revertido a petición explícita del usuario.** Se
   conectó `<PageHeader>`/`<KpiStrip>` a `dashboard-home-view.tsx` y a la cabecera de
   escritorio de `restaurant-user-home-view.tsx` (commit `3076176`), pero el usuario no
   pudo verificarlo cómodamente y pidió deshacerlo con `git revert` (commit `dd5c277`,
   pusheado). **Estado real ahora: exactamente como quedó al cerrar la Fase 0** —
   `<PageHeader>`/`<KpiStrip>` siguen existiendo como componentes pero sin usarse en
   ninguna página. Fase 2 sigue pendiente de verdad, no dar por hecho que está hecha.
2. **Reestructurado el análisis IA en el detalle de una reseña** (commit `c8ea6aa`,
   `app/dashboard/resenas/_components/resenas-review-detail.tsx` y
   `review-ai-section.tsx`, `lib/reviews/types.ts` y `map-analisis-ia.ts`). Antes:
   motivo/riesgo/recomendación se repetían fuera y dentro de un bloque colapsable
   ("Ver análisis →"). Ahora: los 7 apartados reales de `analisis_ia` (resumen,
   motivos, sentimiento + empleado mencionado, impacto, riesgo, recomendación, y
   **fecha de análisis** — `created_at`, no se mostraba en ningún sitio antes) se ven
   una sola vez, en orden, sin clic previo. Se retiraron props muertas
   (`isAnalyzing`/`analysisStep`/`onAnalyze`/`onRegenerate`, vestigios de una versión
   con generación bajo demanda que nunca existió de verdad — el análisis lo genera
   Make fuera de la app). `MetaBlock` pasó a ser un primitivo compartido en
   `review-primitives.tsx`.
3. **Memoria de filtros y scroll en Reseñas** (commit `c3db909`,
   `app/dashboard/resenas/layout.tsx` + `review-filters-context.tsx`, nuevos). Pedido
   del usuario: filtrar en Reseñas, entrar en una reseña y volver no debía perder el
   filtro ni la posición de scroll de la lista — pero sí debía perderse al cambiar de
   sección o recargar. Los filtros y el scroll de la lista pasaron de estado local de
   `resenas-page.tsx` a un contexto de sección.
   - **Causa raíz real, no obvia**: el primer intento (solo el contexto) no funcionó
     en la app real aunque sí en una prueba aislada. El motivo era
     `app/dashboard/_components/motion/page-enter.tsx` — el wrapper de animación de
     entrada usado en **todo** el dashboard usaba `key={pathname}` (ruta completa), lo
     que remonta todo lo de dentro en cualquier cambio de ruta, incluso dentro de la
     misma sección — así que cualquier estado en un `layout.tsx` de sección se perdía
     iguialmente, sin que Next.js lo hubiera desmontado por sí solo. Arreglado
     cambiando la key a nivel de sección (`/dashboard/resenas`, no
     `/dashboard/resenas/[id]`).
   - **Efecto colateral esperado, en todo el dashboard**: la animación de entrada ya
     no se repite al entrar/salir del detalle de una reseña **ni de la ficha de un
     restaurante** (`/dashboard/restaurantes/[slug]`, mismo patrón de sub-ruta) — solo
     al cambiar de sección de verdad. Es una mejora intencionada, no un bug, pero
     avisar si en algún momento se nota "flat"/sin transición donde antes sí la había.
   - Verificado con navegación real (clics, no solo lectura de código) sobre una
     réplica exacta de la estructura real (mismo `PageEnter`, mismo
     `ReviewFiltersProvider`) en una página de preview temporal ya borrada: filtro y
     scroll se mantienen al volver del detalle; se resetean al ir a otra sección y
     volver.

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
4. **Verificado**: `npm run typecheck` limpio (0 errores), `npm run lint` con las mismas
   35 warnings preexistentes de siempre (0 nuevas), `npm run build` limpio. **No
   verificado visualmente en navegador** — bloqueado por la falta de `.env.local` en este
   ordenador (sin credenciales de Supabase la app no sirve datos reales). Como
   `<KpiStrip>` no está conectado a ninguna página todavía, no hay nada nuevo que
   verificar visualmente por ahora; sí quedaría pendiente confirmar visualmente
   `alertas-inbox.tsx` en cuanto haya forma de arrancar la app, aunque el cambio es
   clase-por-clase idéntico al original.

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

1. **`.env.local` ya está completo en este ordenador** (URL/anon key sacadas por API de
   Supabase, service_role pegada a mano por el usuario) — la app arranca en local sin
   problema con `npm run dev`.
2. **Fase 0 sigue con sus 3 piezas construidas pero SIN USAR**: `<PageHeader>` y
   `<KpiStrip>` existen (`app/dashboard/_components/`) pero ninguna página los llama
   todavía. El intento de conectarlos en Inicio (Fase 2) se revirtió a petición del
   usuario (ver sesión 2026-08-16/17 arriba) — **no asumir que Fase 2 está hecha**.
3. Antes de reintentar Fase 2 (o cualquier fase que conecte estas piezas a una
   página real), acordar con el usuario cómo va a verificarlo — a lo largo de esta
   sesión costó bastante encontrar una forma cómoda (el panel de navegador del chat no
   siempre se muestra en su interfaz, y él no puede loguearse fácilmente para
   compartir su sesión conmigo). La vía que sí funcionó siempre: páginas de preview
   temporales sin auth bajo `app/preview/**` (auto-borradas al terminar) para que yo
   verifique, y `npm run dev` en su propia terminal/navegador para que lo vea él con
   datos reales.
4. Si se toca cualquier flujo de navegación lista↔detalle en otra sección (Restaurantes,
   etc.), tener en cuenta el cambio de `page-enter.tsx` de esta sesión (key por sección,
   no por ruta completa) — ya no reinicia estado de un `layout.tsx` de sección al
   navegar dentro de ella, a diferencia de antes.
