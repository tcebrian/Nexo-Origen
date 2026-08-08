@AGENTS.md

# Nexo Origen — contexto permanente del proyecto

Dashboard SaaS de reputación online para cadenas de restaurantes (reseñas de Google,
alertas, informes). Multi-tenant: varias empresas clientas (ej. "Grupo Hámbar", "Vault")
comparten la misma app y base de datos, aisladas por scope.

**Antes de cualquier sesión nueva, lee `PROGRESS.md`** (estado exacto, pendientes,
próximos pasos) — este archivo (CLAUDE.md) es solo el conocimiento que no cambia de
sesión a sesión.

## Stack
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 (sin
`tailwind.config.js`, todo en `app/globals.css`) · Framer Motion · Supabase (auth + datos).
Ver la skill `.claude/skills/nexo-design/SKILL.md` para el sistema de diseño completo
(tokens, utilidades, motion) — se activa sola en cambios visuales, no hace falta invocarla.

## Modelo de datos y permisos
Jerarquía: `empresas` → `marcas` → `restaurantes` → `resenas`. 4 roles (`super_admin`,
`empresa_admin`, `marca_admin`, `restaurante_user`) definidos en `lib/auth/permissions.ts`.
El alcance de datos de cada usuario se resuelve en `lib/auth/scopes.ts::fetchUserScope`
y se aplica en `lib/auth/data-scope.ts` (filtra `kpi_restaurantes`/`resenas`/`kpi_diario`
por `empresa_id`/`marca_id`/`restaurante_id` antes de que lleguen al cliente).
`NEXT_PUBLIC_DATA_SCOPING_ENABLED=true` en `.env.local` — con `false` todos los roles
no-super_admin ven todo (solo pensado para desarrollo sin aislamiento).

**Perfiles de un solo restaurante**: cualquier perfil (sea `restaurante_user` o un
`empresa_admin`/`marca_admin` con un único restaurante en su scope) usa la vista
compacta `RestaurantUserHomeView` en vez del panel de red, y no ve "Restaurantes" en
el menú (lógica en `dashboard-home-view.tsx` y `dashboard-shell.tsx`, basada en
`useAuth().primaryRestaurant`, no en el rol).

## Peculiaridades reales de Supabase (no son bugs de la app, son el esquema real)
- Tabla `marcas` **no tiene columna `empresa_id`** — el vínculo empresa↔marca se
  resuelve vía `restaurantes` (que sí tiene `empresa_id` y `marca_id`). Ver
  `lib/auth/scopes.ts::fetchMarcaIdsByEmpresa`.
- `restaurantes.media_google` / `total_resenas_google`: media pública de Google Maps,
  actualizada por un proceso externo (scraper) que **no vive en este repo** — esta app
  solo lee esos campos, nunca los escribe.
- Las reseñas (`resenas`) también las trae ese mismo proceso externo por `place_id`;
  esta app tampoco escribe en esa tabla.
- RLS de `resenas`/`restaurantes`/`marcas`/`kpi_diario`/`dashboard_kpis` es permisivo
  (`USING (true)` para `anon, authenticated`) — el aislamiento real ocurre en la capa
  de aplicación (`lib/auth/data-scope.ts`), no en la base de datos. Pendiente de
  reforzar si se quiere aislamiento a nivel de RLS también (ver PROGRESS.md).

## Errores reales ya encontrados — no los repitas
- **Nunca instancies un cliente de Supabase a nivel de módulo** (`export const x = createClient()`
  fuera de una función). Rompe el build entero si faltan las env vars, y si el módulo
  es importado por código que también corre en el navegador (ver siguiente punto),
  rompe el build de Next con un error de `next/headers` en un Client Component.
  Usa siempre una función (`getSupabase()`) que se llama en el momento de uso.
- **`lib/restaurants/restaurants-repository-shared.ts` se ejecuta en el navegador** en
  algunos flujos (vía `lib/restaurants/repository.ts` con `import()` dinámico, usado por
  `useRestaurantDetail`). No añadas ahí ninguna llamada directa a Supabase server-only
  (`getSupabaseDataClientForServer`, `next/headers`, etc.) — si un dato nuevo hace falta
  en `RestaurantDetail`, tráelo enriqueciendo `KpiRestaurantRow` en el catálogo server-side
  (`lib/supabase/restaurantes.ts::enrichKpiRows`), no con una query nueva ahí.
- **Los SVG de logos necesitan `width`/`height` explícitos en la etiqueta `<svg>` raíz**,
  no solo `viewBox` — si no, `next/image` los puede renderizar a 0×0 en ciertos contextos
  (pasó de verdad con el logo de Vault).
- **Toggle de clases Tailwind `translate-x-full`/`translate-x-0` (o pares equivalentes)
  para mostrar/ocultar un panel puede no aplicar en el navegador de pruebas de este
  entorno** (problema de orden de cascada). Usa `hidden`/`flex` condicionalmente, o un
  `style={{ transform: ... }}` inline, no dos clases de Tailwind que compiten por la
  misma propiedad.
- **La consola del navegador de pruebas puede mostrar errores "pegados"** de antes de un
  arreglo, incluso tras `console.clear()` y recarga. Antes de asumir que un error sigue
  vivo, comprueba el contenido real servido (`fetch` del chunk, o el contenido/DOM de
  la página) en vez de fiarte solo de `onlyErrors: true`.
- El middleware (`middleware.ts`) debe **fallar cerrado**: si Supabase no está
  configurado, bloquea `/dashboard` y `/api`, nunca los deja pasar sin autenticar.

## Qué NO tocar al hacer cambios de diseño/UI
`lib/auth/**`, llamadas a Supabase, scopes de datos — solo presentación. (Reforzado
también en la skill `nexo-design`.)
