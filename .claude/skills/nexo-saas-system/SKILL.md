---
name: nexo-saas-system
description: Gobierna la arquitectura visual, el layout, la jerarquía, el espaciado, la densidad, la navegación y la consistencia estructural de Nexo Origen a nivel de producto — no de componente individual. Úsala SIEMPRE que se rediseñe una pantalla o sección completa, se cree una pantalla nueva desde cero, el usuario diga que algo "parece un dashboard genérico", "hay demasiadas tarjetas/cajas", "no parece un producto real" o pida reorganizar/estructurar una vista. También antes de decidir si un dato nuevo necesita su propia tarjeta o no. Complementa a nexo-design (que cubre tokens, motion y el acabado de un componente ya decidido) — esta skill decide la estructura ANTES de que nexo-design pula el resultado; úsalas juntas, en ese orden, en cualquier rediseño de sección completa.
---

# Nexo SaaS System — arquitectura visual y estructura del producto

## 0. Relación con `nexo-design` — no es redundante, es la capa anterior

`nexo-design` responde a "¿cómo hago que este componente se vea premium?" (tokens, motion, tipografía de una tarjeta, un gráfico). **Esta skill responde a una pregunta anterior: "¿debería esto ser una tarjeta, o algo más simple?"** Úsalas en este orden en cualquier rediseño de sección: primero decide la estructura aquí (qué superficies existen, cómo se agrupan, qué es tabla/lista/grid y qué es realmente una tarjeta), y solo después pule el resultado con `nexo-design`. Si aplicas `nexo-design` directamente sobre una pantalla mal estructurada, el resultado es una versión más bonita del mismo problema: una sopa de tarjetas con mejores sombras.

## 1. El problema real, medido, no supuesto

No es una sospecha estética: hay evidencia contable en el propio código. Contando superficies con `rounded-xl border` / `rounded-2xl border` (una tarjeta o caja independiente) por sección del dashboard: **Reseñas ≈ 44, Restaurantes ≈ 46**, frente a Ranking ≈ 3. Eso no es "algunas secciones tienen más contenido" — es que en unas partes de la app cada dato individual se envuelve en su propia caja con borde y fondo, y en otras no. Un ejemplo muy concreto, de esta misma sesión: `RestaurantesStatusSummary` pinta **4 tarjetas separadas** para lo que conceptualmente es una única fila de KPIs de red (en objetivo / vigilancia / riesgo / media) — cuatro bordes, cuatro fondos, cuatro sombras, para un solo grupo de números relacionados. Y la tarjeta de restaurante que se acaba de construir (`restaurantes-card.tsx`) tiene, dentro de una tarjeta, dos `metricCell` (más tarjetas) para Media y Evolución. Card dentro de card dentro de card. Ese es exactamente el patrón a vigilar — incluido en trabajo reciente y aprobado, no es un defecto ajeno.

## 2. Principio central: jerarquía de superficies, no reflejo de tarjeta

Antes de envolver cualquier dato o bloque en `rounded-xl border bg-[var(--nexo-card)]`, pregúntate qué es realmente:

- **¿Es una entidad seleccionable e independiente** (un restaurante, una reseña, un empleado, una alerta concreta)? → tarjeta o fila, correcto, es lo que representa.
- **¿Es un dato o métrica que pertenece a un conjunto mayor** (las 4 cifras de un resumen de red, los campos de un formulario, las columnas de un breakdown)? → **no es una tarjeta**. Es una fila de tabla, un elemento de una lista con divisores, una columna de un grid con espacio en vez de borde, o simplemente un número grande con una etiqueta encima, sin caja propia.
- **¿Es una agrupación de varias entidades del mismo tipo**? → una única superficie contenedora con divisores internos (`divide-y`), no N superficies independientes una junto a otra.

La pregunta que debe hacerse el propio Claude antes de escribir `rounded-2xl border bg-[var(--nexo-card)]` una vez más: *¿esto necesita su propio borde y fondo, o basta con espacio, tipografía y un divisor?*

## 3. Herramientas que ya existen en el proyecto para evitar otra tarjeta

No hay que inventar nada nuevo, ya está todo en el código:

- **Lista con una sola superficie**: `divide-y divide-[var(--nexo-border)]` dentro de un único `rounded-xl border` — patrón ya real en `app/dashboard/alertas/_components/alertas-inbox.tsx`. Úsalo para cualquier conjunto de ítems del mismo tipo en vez de una tarjeta por ítem.
- **Tabla**: `RestaurantesTable` (`app/dashboard/restaurantes/_components/restaurantes-table.tsx`) es el patrón de referencia para datos tabulares en escritorio — columnas alineadas, cabecera en mayúsculas con tracking, sin borde por fila salvo el divisor inferior.
- **Grid sin caja**: `grid grid-cols-*` con `gap-*` como único separador — el espacio en blanco ya es una separación visual válida, no todo grid necesita que cada celda tenga su propio borde.
- **Jerarquía tipográfica en vez de caja**: un número en `font-mono` grande + una etiqueta pequeña en mayúsculas encima, sin fondo ni borde, ya comunica "esto es un dato destacado" sin necesitar una tarjeta — se usa dentro de las tarjetas existentes (`MediaBlock`) pero es igual de válido fuera de una, directamente sobre el fondo de la sección.
- **Toolbar/cabecera de sección**: fila `flex` con controles alineados (ya el patrón de `restaurantes-toolbar.tsx`) en vez de meter cada filtro en su propia caja.

## 4. Escala de espaciado y tipografía — la que ya existe de facto, nombrada

El proyecto no tiene una escala formal documentada (no hay tokens `--nexo-space-*` ni `--nexo-text-*` en `globals.css`, solo color/sombra/radio/motion). Lo que hay es una escala **de facto** ya en uso, dispersa en clases arbitrarias (`text-[11px]`, `text-[13px]`, `text-[28px]`...). Hasta que se decida formalizarla en tokens reales:

- **Texto**: `10–11px` (kickers/etiquetas en mayúsculas), `12–13px` (texto secundario/cuerpo), `15px` (títulos de tarjeta/fila), `17–21px` (subtítulos de sección), `26–28px` (títulos de página), `36px` (cifra destacada tipo KPI). No introduzcas un tamaño intermedio nuevo sin comprobar antes si uno de estos ya sirve.
- **Espaciado**: `gap-2`/`gap-3` para elementos muy relacionados dentro del mismo bloque, `gap-4`/`gap-6` entre bloques del mismo grupo, `mb-6`/`mb-8` entre secciones de una página. La densidad debe bajar (más espacio, no más borde) a medida que subes de nivel: entre secciones, espacio; dentro de una sección, divisores; dentro de una fila, casi nada.

## 5. Estructura global ya establecida — no la reinventes

- Contenedor de página: `mx-auto max-w-[1400px]` (ya usado en todas las páginas del dashboard).
- Corte responsive: `lg` (1024px) es el único breakpoint real de la app para el cambio móvil/escritorio — sidebar fijo de 250px vs. barra inferior tipo app nativa (`dashboard-shell.tsx`). No introduzcas `md:` o `sm:` como corte estructural salvo dentro de un componente que ya vive en un lado de ese corte.
- Cabecera de sección: título + subtítulo + acción principal a la derecha, mismo patrón en todas las páginas — mantenlo si rediseñas una sección, es lo que da sensación de "mismo producto" al cambiar de pantalla.

## 6. Checklist antes de dar por bueno un rediseño estructural

1. Cuenta las superficies con borde+fondo propio visibles sin hacer scroll (`rounded-xl|2xl border`). Si son más de 5-6 en una sola vista, sospecha de card soup y revisa si algunas deberían fundirse en una lista/tabla/grid.
2. ¿Hay dos o más elementos adyacentes del mismo tipo que hoy son tarjetas independientes y podrían ser una sola superficie con `divide-y`?
3. ¿La jerarquía (qué es más importante) se nota por tamaño/peso/espacio, o solo porque tiene más borde que su vecino?
4. Compara el recuento de "cajas" del archivo antes y después del cambio — si sube, tiene que haber una razón explícita (de verdad son entidades independientes), no inercia.
5. Aplica después el checklist de `nexo-design` (motion, tokens, responsive, verificación visual) sobre la estructura ya decidida aquí.

## 7. Qué NO toca

Igual que `nexo-design`: sin lógica de negocio, sin Supabase, sin auth — decisiones puramente de estructura y presentación. Esta skill decide *qué tipo de superficie* usar (tarjeta / lista / tabla / grid / bloque tipográfico); no decide colores, sombras ni motion — eso lo cubre `nexo-design` sobre la estructura ya elegida aquí.
