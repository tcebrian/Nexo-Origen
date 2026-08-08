---
name: nexo-design
description: Actúa como director de diseño UI/UX senior para el proyecto Nexo Origen (dashboard SaaS de reputación para restaurantes, Next.js 16 + Tailwind v4 + Supabase). Úsala SIEMPRE que se vaya a crear, rediseñar, tocar el estilo de, o mejorar visualmente cualquier página, componente, tarjeta, gráfico, formulario o pantalla de este proyecto — incluso si el usuario solo dice "mejora esto", "hazlo más bonito", "no me gusta cómo se ve" o pide un cambio pequeño de estilo. También úsala antes de añadir cualquier gráfico, animación o elemento visual nuevo. No es necesaria para cambios puramente de lógica/datos que no toquen el JSX o las clases de un componente.
---

# Nexo Design — director de diseño del proyecto

Este proyecto ya tiene un sistema de diseño propio, coherente y bastante trabajado (tema oscuro premium morado). El trabajo de esta skill NO es inventar un estilo nuevo cada vez, sino **aplicar con criterio de diseñador senior el sistema que ya existe**, y solo extenderlo cuando de verdad haga falta.

**Antes de aplicar esta skill a un rediseño de pantalla o sección completa** (no a un ajuste puntual de un componente ya existente), aplica primero `nexo-saas-system` — decide ahí qué debe ser tabla/lista/grid/bloque tipográfico y qué debe ser tarjeta de verdad, evitando el patrón "card soup" (una tarjeta por dato). Esta skill pule el acabado de la estructura que `nexo-saas-system` ya decidió; no la sustituye ni decide por su cuenta cuántas tarjetas debe haber en una pantalla.

## 1. Contexto técnico (para no tener que re-investigar)

- **Stack**: Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4 (sin `tailwind.config.js`, todo vía CSS en `app/globals.css`), Framer Motion, Supabase.
- **Gráficos**: SVG hechos a mano en `app/dashboard/_components/charts.tsx` (`LineChart`, `DonutChart`, `HorizontalBarChart`, `StackedVolumeBarChart`, `MiniSparkline`, `HealthDonut`). No hay librería de charts — no instalar una sin que el usuario lo pida.
- **Iconos**: SVG inline a mano (`stroke="currentColor"`, `strokeWidth` 1.75–2). No hay lucide/heroicons instalados — sigue el mismo patrón a mano salvo petición explícita de librería.
- **Tipografía** (`app/layout.tsx`): Geist (UI), Geist Mono (SIEMPRE en cifras/números grandes, con `tabular-nums`), Cormorant Garamond (marca/branding).

## 2. Sistema de diseño existente — reutilizar, no reinventar

**Tokens de color** en `app/globals.css` (prefijo `--nexo-*`): `--nexo-bg` (#05030A), `--nexo-surface`, `--nexo-card`, `--nexo-text` / `-secondary` / `-tertiary`, `--nexo-border` / `-strong`, `--nexo-accent` (#a78bfa) con `-hover`/`-muted`/`-border`/`-glow`, y `--nexo-success` / `--nexo-watch` / `--nexo-critical` (cada uno con variante `-muted` y `-border` para fondos/bordes suaves). Radios `--nexo-radius`/`-lg`, sombras `--nexo-shadow-sm`/`-md`/`-lg`, transición estándar `--nexo-transition`. Tokens específicos de gráficos: `--nexo-chart-line/fill/grid/label/goal`.

**Utilidades reutilizables** en `app/dashboard/_components/ui/nexo-styles.ts` y `app/dashboard/_components/styles.ts`: `glass`/`glassPanel` (glassmorphism: `border-white/[0.06-0.08]` + `bg-white/[0.02-0.03]` + `backdrop-blur-2xl`), `shellCard`, `entityCard`, `summaryCard`, `btnPrimary`/`btnOutline`/`btnGhost`, `textPageTitle`/`textSectionTitle`/`textBody`, `metricPill`, `skeletonBlock`. **Antes de escribir una clase Tailwind larga a mano para una tarjeta/botón, comprueba si ya existe una utilidad para eso.**

**Motion** en `app/dashboard/_components/motion/motion-config.ts`: `PAGE_ENTER`, `STAGGER_ROW` + `STAGGER_CHILD_DELAY`, `PANEL_SLIDE`, `BACKDROP_FADE`, `CARD_HOVER`, `CARD_TRANSITION`, `CHART_DRAW_MS` (900ms). Usa estos tokens en vez de inventar duraciones/easings sueltos — así todo el motion de la app se siente igual. Respeta siempre `usePrefersReducedMotion()`.

**Layout del dashboard** (`app/dashboard/_components/dashboard-shell.tsx`): en escritorio (`lg:` y superior) sidebar fijo de 250px; en móvil, barra superior compacta de 49px + barra de navegación inferior fija (estilo app nativa, hasta 4 iconos + botón "Más" con panel deslizante). **Cualquier cambio de diseño debe considerar explícitamente móvil y escritorio por separado** (clases base / `lg:hidden` para móvil, `hidden lg:...` para escritorio) — nunca asumas que arreglar uno no rompe el otro.

**Marcas**: sistema `BrandId` en `lib/restaurants/brand-visuals.ts`, componentes `BrandMark`/`AllBrandsMark`. Si añades un logo SVG nuevo, dale siempre `width`/`height` explícitos en la etiqueta `<svg>` raíz (no solo `viewBox`) — si no, `next/image` puede renderizarlo a 0×0 en ciertos contextos; ya nos pasó una vez.

## 3. Qué exigir en cada cambio visual (pensar como diseñador senior de un SaaS premium)

Antes de dar por bueno un cambio, revisa contra esto:

- **Jerarquía clara**: en cada pantalla, lo más importante debe notarse a simple vista por tamaño, peso o posición — no todo del mismo tamaño en una rejilla uniforme. Si dos tarjetas contiguas tienen el mismo peso visual pero distinta importancia, algo está mal.
- **Responsive real, no "que no se rompa"**: piensa mobile-first en cifras/gráficos clave, y decide activamente qué se simplifica u oculta en pantallas pequeñas en vez de simplemente encoger todo.
- **Motion con propósito**: usa los tokens de `motion-config.ts` para transiciones de entrada, hover y cambios de estado. La animación debe ayudar a entender qué cambió, no ser decoración.
- **Gráficos integrados, no genéricos**: mismos tokens de color que el resto de la pantalla, cifras en `font-mono tabular-nums`, y siempre con contexto (línea de objetivo, comparación vs. periodo anterior) — un número grande solo, sin referencia, es un gráfico a medias.
- **Evita lo que "huele a IA genérica"**: emojis sueltos sin fondo como icono, sombras planas sin criterio, gradientes arcoíris, exceso de `rounded-full`/`rounded-3xl` sin motivo, tarjetas idénticas repetidas en fila sin variar énfasis.
- **Reutiliza antes de crear**: usa tokens/utilidades existentes; si hace falta un patrón nuevo que se repetirá, conviértelo en utilidad reutilizable (no en estilo inline suelto que solo vive en un componente).
- **Consistencia entre secciones**: Inicio, Restaurantes, Reseñas, Alertas, Nexo Prevent y Ranking deben sentirse como la misma app, no como pantallas distintas cosidas.

## 4. Qué NO tocar

Un cambio de diseño es solo presentación. Al aplicar esta skill, **no modifiques**:
- Lógica de autenticación/sesión/scopes (`lib/auth/**`).
- Llamadas o queries a Supabase, ni la forma de los datos que llegan a un componente.
- Comportamiento funcional existente (rutas, permisos, cálculos) — solo cómo se ve.

Si un cambio visual "obliga" a tocar lógica o datos, párate y dilo explícitamente antes de hacerlo.

## 5. Verificación obligatoria después de cualquier cambio

1. `npm run typecheck` y `npm run lint` limpios (0 errores).
2. `npm run build` sin errores (los cambios de estilo no deberían romper el build, pero verifica si tocaste componentes compartidos).
3. Comprobación visual real en el navegador de pruebas, **por separado**:
   - Móvil: `resize_window` a 375×812 (o similar).
   - Escritorio: 1280×800.
   - Si `computer` screenshot falla porque el panel no está visible, verifica igualmente por DOM/JS (`get_page_text`, medir `getBoundingClientRect`/`getComputedStyle` de los elementos clave) en vez de asumir que quedó bien.
4. Si el cambio afecta a un componente compartido (usado en varias páginas), revisa al menos una página más donde se use, para confirmar que no rompiste la consistencia visual en otro sitio.
