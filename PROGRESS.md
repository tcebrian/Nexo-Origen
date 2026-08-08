# Estado del proyecto — Nexo Origen

**Última actualización:** 2026-08-08 (sesión larga de auditoría + arreglos + onboarding
de cliente + rediseño móvil). Léelo entero antes de seguir trabajando; sustituye a
"contexto perdido" de una conversación anterior.

## ⚠️ Importante antes de nada

- **Todo lo de esta sesión sigue SIN COMMITEAR.** El repo solo tiene un commit
  (`a7d75e4 Primer deploy Nexo Origen`). Hay ~35 archivos modificados y varios nuevos
  en el working tree (`git status` para verlos). Nadie ha pedido hacer commit todavía —
  pregunta al usuario si quiere que se comitee antes de seguir cambiando más cosas,
  para no acumular un diff gigante de trabajo distinto mezclado.
- `.env.local` tiene credenciales **reales** de Supabase (URL, anon key, service role
  key) y `NEXT_PUBLIC_DATA_SCOPING_ENABLED=true`. Está en `.gitignore`, no se sube.
- Node modules instalados, build/typecheck/lint verificados limpios en el último
  cambio (repetir tras cualquier edición: `npm run typecheck && npm run lint`).
- Servidor de pruebas: `.claude/launch.json` ya configurado (`nexo-origen-dev`,
  puerto 3000) — usar `preview_start` con ese nombre, no `npm run dev` por Bash.

## Qué se hizo en esta sesión (orden cronológico resumido)

1. **Auditoría inicial del proyecto** (arquitectura, roles, stack).
2. **Arreglos de robustez/seguridad**:
   - Cliente Supabase instanciado a nivel de módulo → convertido a perezoso
     (`lib/supabase.ts::getSupabase()`), causaba caída total del build/app sin env vars.
   - Añadidos `app/error.tsx`, `app/global-error.tsx`, `app/dashboard/error.tsx`
     (no existía ningún error boundary en toda la app).
   - `middleware.ts`: pasó de "fail-open" (dejaba pasar todo si Supabase no estaba
     configurado) a "fail-closed" (bloquea `/dashboard` y `/api`).
   - Eliminada bandera muerta `NEXT_PUBLIC_AUTH_ENABLED` (no gateaba nada).
   - `npm audit fix` (sin `--force`): 3 vulnerabilidades resueltas sin riesgo.
   - Next.js 16.2.7 → 16.3.0, sharp 0.34 → 0.35 (parchean CVEs, incluido un bypass de
     middleware). Verificado que el middleware sigue funcionando igual.
   - **Sin resolver a propósito**: vulnerabilidad de `uuid` (vía `exceljs`) — el único
     "fix" disponible es un *downgrade* de exceljs a 3.4.0, más riesgo que beneficio.
3. **Onboarding de cliente nuevo — Vault Burger SL**:
   - Empresa `Vault` (id 2, ya existía, se corrigió un duplicado que creé por error),
     marca `Vault` (id 8), restaurante `Vault Pamplona` (id 33, `place_id` conectado a
     un scraper externo que ya trae reseñas reales de Google).
   - Perfil `vaultprueba@gmail.com`, rol `empresa_admin`, empresa_id 2. Contraseña
     puesta a mano vía Admin API (no hay flow de "recuperar contraseña" en la app —
     ver pendientes). Igual para `bksoria@nexoorigen.com` (reset de contraseña).
   - Logo de Vault añadido al sistema de marcas (`lib/restaurants/brand-visuals.ts`,
     `public/brands/vault.svg`) — arreglado el bug de SVG sin `width`/`height`.
   - Arreglado bug real: `marcas` no tiene `empresa_id`, así que el cálculo de "marca(s)
     de esta empresa" fallaba silenciosamente para todo `empresa_admin` (afectaba
     también a Grupo Hámbar sin que se notara). Ver `lib/auth/scopes.ts`.
4. **Diseño responsive del dashboard** (mobile-first, sin tocar desktop salvo que se
   indique):
   - Sidebar de escritorio (250px) intacto. Móvil: barra superior compacta (49px,
     logo + badge de empresa) + barra de navegación inferior fija tipo app nativa
     (4 iconos + "Más" con panel deslizante).
   - Periodo por defecto: semana natural actual (lunes–domingo) en vez de "últimos 14
     días", recalculado cada vez que se abre sin selección manual guardada.
   - Panel de fechas simplificado: campos de texto (Desde/Hasta) + calendario, quitados
     los accesos rápidos y el "periodo guardado" (código muerto limpiado del todo).
   - Login: más compacto en móvil (logo/textos reducidos vía breakpoints, sin tocar
     escritorio).
5. **`RestaurantUserHomeView`** (vista de perfiles de 1 restaurante — Vault, Soria y
   cualquier futuro perfil similar) rediseñada varias iteraciones en móvil:
   - Tarjeta superior con **Media de Google** (`restaurantes.media_google`) y **Media
     del periodo analizado** lado a lado, más reseñas del periodo y variación.
   - Franja Estado/Alertas con iconos en círculo.
   - Gráfico **"Evolución de tu media"**: ceñido al periodo filtrado (no a un mes fijo
     con huecos vacíos), usa `LineChart` existente.
   - Acción recomendada, Nexo Prevent (compacto), Principales motivos (solo si hay
     datos), Alertas activas (solo si hay), Reseñas recientes.
   - Botón **"Responder"** en cada reseña — visual únicamente, deshabilitado, con
     badge "Próximamente". Sin backend, listo para cuando se quiera conectar.
   - Menú: "Restaurantes" se oculta para perfiles de un solo restaurante (redundante
     con Inicio) — `dashboard-shell.tsx`, basado en `primaryRestaurant`, no en el rol.
6. **Skill de diseño**: creada `.claude/skills/nexo-design/SKILL.md` — actúa como
   director de diseño senior en cualquier cambio visual futuro (contexto del sistema
   de diseño real, checklist de calidad, qué no tocar, verificación obligatoria).
   Se activa sola, no hace falta invocarla a mano.

## Decisiones de diseño a recordar
- Un perfil se trata como "de un solo restaurante" por **tener un único restaurante en
  su scope**, no por su rol — así Vault (`empresa_admin` con 1 local) tiene la misma
  experiencia que un `restaurante_user` de verdad, y el mismo patrón sirve para
  cualquier local suelto de Grupo Hámbar en el futuro.
- Media de Google y Media del periodo se muestran **siempre juntas y diferenciadas**
  (una es el dato público externo, la otra el cálculo interno del periodo elegido) —
  no fusionarlas en un solo número.
- Diseño mobile y desktop se tratan como dos flujos JSX separados dentro del mismo
  componente (`lg:hidden` / `hidden lg:...`), no un único layout que se encoge — ha
  sido la única forma de evitar romper uno al arreglar el otro.

## Cosas que NO se deben tocar sin que el usuario lo pida explícitamente
- `lib/auth/**` (permisos, scopes, sesión) — tocarlo sin querer puede filtrar datos
  entre clientes (Vault ↔ Grupo Hámbar).
- Esquema de Supabase (tablas/columnas reales) — solo se ha *leído* y adaptado el
  código a lo que ya existe, nunca se ha migrado el esquema.
- La vulnerabilidad de `uuid`/`exceljs` — dejada así a propósito (ver arriba).
- El aviso de `AGENTS.md` sobre que esta versión de Next.js "no es la que conoces":
  en la práctica, hasta ahora todo se ha comportado como Next.js estándar salvo el
  aviso de `middleware.js` → `proxy.js` (deprecado, sigue funcionando igual).

## Pendiente / no resuelto todavía
1. **No existe pantalla de "recuperar/crear contraseña"** — cada vez que alguien
   olvida la suya hay que resetearla a mano vía script con la service role key. Haría
   falta antes de dar de alta clientes reales (no de prueba).
2. **RLS de Supabase permisivo** (`USING (true)`) — el aislamiento real es solo de
   la app, no de la base de datos. Reforzarlo es trabajo aparte, no se ha tocado.
3. **`app/dashboard/informes/_components/informes-automaticos.tsx` e
   `informes-generator.tsx`** siguen con "Grupo Hámbar" fijo en vez de dinámico
   (solo lo ve `super_admin`, baja prioridad).
4. **Botón "Responder" a reseñas**: solo visual, sin funcionalidad ni backend.
5. **`bksoria` (BK Soria)**: `media_google` está `null` en Supabase — el scraper
   externo aún no lo ha rellenado para ese local. La tarjeta ya maneja el caso (muestra
   "—" / "Sin datos de Google"), no es un bug, solo falta el dato en origen.
6. No se pudo verificar/instalar un plugin `frontend-design` de Anthropic ni un
   "typescript-lsp" — no hay acceso al CLI `claude` ni existen como conector MCP. Si
   el usuario tiene el nombre/origen exacto, revisarlo con calma en otra sesión.
7. Warnings de ESLint preexistentes (35, variables sin usar / deps de hooks) — no
   bloquean nada, no se han tocado por no ser parte de lo pedido.

## Próximos pasos sugeridos (no hechos, a decidir con el usuario)
- Decidir si comitear el trabajo actual antes de seguir.
- Seguir aplicando el criterio de `nexo-design` al resto de secciones móviles
  (Restaurantes, Reseñas, Alertas, Nexo Prevent, Ranking) — solo se ha rediseñado
  a fondo la home de perfil de un restaurante.
- Construir la pantalla de recuperar/crear contraseña (pendiente #1).
- Decidir qué hacer con el botón "Responder" (pendiente #4) cuando se quiera activar.
