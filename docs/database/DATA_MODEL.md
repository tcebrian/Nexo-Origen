# Nexo Origen — Modelo de datos objetivo

## Propósito

Este documento define **cómo debe crecer la información de Nexo**.

No es un script SQL ni una orden para crear todas estas tablas ahora.

Las estructuras propuestas se introducirán únicamente cuando llegue la fase correspondiente y mediante migraciones controladas.

---

# 1. Principios

## 1.1 Identidad interna estable

Nexo debe tener IDs internos propios.

Los IDs de Google, StoreAce, TPV, delivery u otros proveedores son referencias externas, no la identidad principal de Nexo.

Ejemplo conceptual:

`restaurante Nexo 42`

puede corresponder a:

- Google Place ID X;
- StoreAce location 10573;
- proveedor delivery ABC;
- sistema de horarios 991.

Si cambia un proveedor, el restaurante Nexo sigue siendo el mismo.

---

## 1.2 Hechos antes que agregados

Guardar primero la información suficientemente granular para poder recalcular.

Después pueden existir:

- vistas;
- tablas KPI;
- snapshots;
- cachés;
- agregados.

Pero un KPI no debe ser la única copia de la realidad cuando podamos conservar el hecho que lo originó.

---

## 1.3 Histórico antes que sobrescritura

Cuando un dato cambia y su evolución importa, conservar histórico.

Especialmente:

- reseñas editadas;
- objetivos;
- configuraciones;
- asignaciones;
- métricas operativas;
- datos recibidos de fuentes externas.

---

## 1.4 Separar hechos de interpretación

Ejemplo:

**Hecho**
- una reseña tiene 1 estrella;
- tiempo Auto = 4:12;
- ventas = 2.340 €.

**Interpretación**
- motivo principal: espera;
- posible saturación;
- recomendación de revisar dotación.

No mezclar ambos conceptos como si tuvieran el mismo nivel de certeza.

---

## 1.5 Trazabilidad

Un dato importante debería poder responder:

- de qué proveedor vino;
- cuándo se obtuvo;
- a qué restaurante corresponde;
- qué periodo representa;
- si fue modificado/reprocesado;
- qué versión de análisis lo interpretó cuando corresponda.

---

# 2. Jerarquía principal

Modelo conceptual:

```
empresa
  └── marca
       └── restaurante
```

A largo plazo conviene que esta jerarquía sea explícita y no dependa de inferencias accidentales.

No es obligatorio modificar `marcas` inmediatamente.

La normalización se hará cuando exista una migración segura.

---

# 3. Mapeo de proveedores externos

En lugar de añadir columnas como:

- `google_id`
- `storeace_id`
- `delivery_x_id`
- `delivery_y_id`

directamente a `restaurantes`, preferir un modelo conceptual tipo:

## restaurant_external_ids

- `id`
- `restaurante_id`
- `provider`
- `external_id`
- `metadata` opcional
- `active`
- timestamps

Ejemplo:

| restaurante_id | provider | external_id |
|---|---|---|
| 42 | google | ChIJ... |
| 42 | storeace | 10573 |
| 42 | workforce_x | LOC-008 |

Esto desacopla Nexo de cada proveedor.

Debe existir una restricción de unicidad adecuada por proveedor / identificador.

---

# 4. Eventos de ingesta

Para integraciones donde sea útil auditar o reprocesar, puede existir una capa conceptual tipo:

## ingestion_events

- proveedor;
- tipo de dato;
- identificador externo;
- restaurante resuelto;
- momento de recepción;
- estado;
- hash/idempotency key;
- payload bruto cuando sea razonable;
- error si falló;
- versión del parser.

No todo dato necesita guardar para siempre un payload bruto.

Se utiliza cuando aporta:

- auditoría;
- reprocesamiento;
- diagnóstico;
- deduplicación.

---

# 5. Reputación

## 5.1 Situación actual

`resenas` funciona hoy como registro consumido por la aplicación.

Debe mantenerse compatible durante la migración.

## 5.2 Problema de reseñas editadas

Una reseña de Google puede cambiar:

- estrellas;
- comentario;
- fecha de modificación.

Si únicamente sobrescribimos el snapshot, podemos perder la verdad histórica.

Ejemplo:

Marzo:
- 1 estrella

Abril:
- el mismo usuario la cambia a 5 estrellas

Un informe histórico de marzo no debería cambiar silenciosamente meses después si pretendemos medir lo que ocurrió en marzo.

## 5.3 Diseño V2 preparado

La identidad lógica propuesta es:

`provider + place_id + reviewer_id`

No depende únicamente de `review_id`, porque un mismo usuario/local puede aparecer con distintos IDs externos.

El diseño está preparado, pero **no aplicado a producción**, en:

`supabase/review_history_v2.sql`

### resena_logicas

Estado actual de una reseña lógica:

- restaurante;
- proveedor;
- place ID;
- reviewer ID;
- review ID actual;
- estrellas/comentario actuales;
- URLs separadas;
- fechas de primera/última observación;
- estado visible/posiblemente oculto/oculto.

### resena_provider_ids

Relaciona todos los IDs externos observados con la misma reseña lógica.

Esto permite que `reviewId A` y `reviewId B` pertenezcan a la misma reseña si la identidad cuenta + place coincide.

### resena_versiones

Histórico inmutable:

- versión;
- review ID observado;
- estrellas;
- comentario;
- fingerprint;
- tipo de evento: new / edited / recreated;
- published_at;
- detected_at;
- vigencia.

Una versión histórica no se sobrescribe.

### reputation_period_closures

Fotografía inmutable de una semana/mes cerrado:

- volumen;
- positivas;
- neutrales;
- negativas;
- media;
- ediciones;
- mejoras/empeoramientos;
- fecha de cierre.

Una edición posterior no modifica un periodo ya cerrado.

## 5.4 Decisión de ingesta

La lógica pura vive en:

`lib/reputation/review-identity.ts`

Clasifica cada observación como:

- `new`;
- `unchanged`;
- `edited`;
- `recreated`.

Debe validarse en modo sombra con datos reales antes de sustituir la lógica productiva de Make.

La tabla actual `resenas` seguirá siendo compatible durante la transición.

---

# 6. Análisis IA de reseñas

El análisis debe vincularse a una identidad estable de reseña/versión.

A futuro es deseable registrar:

- análisis;
- modelo/proveedor cuando sea necesario para auditoría;
- versión del esquema/prompt;
- fecha de análisis;
- estado;
- campos estructurados.

Así podremos reanalizar una reseña sin confundir un análisis nuevo con uno histórico.

---

# 7. Ventas

No diseñar ventas solo pensando en una gráfica mensual.

Necesitamos soportar:

- restaurante;
- periodo;
- canal;
- ventas;
- tickets;
- ticket medio derivable;
- fuente.

Modelo conceptual:

## sales_metrics

- `restaurante_id`
- `interval_start`
- `interval_end`
- `channel`
- `gross_sales` cuando exista
- `net_sales` cuando exista
- `tickets`
- `currency`
- `source`
- timestamps de ingesta

La granularidad preferida será la mayor que el proveedor entregue de forma fiable y útil.

Si StoreAce ofrece datos horarios, conservarlos permite recalcular:

- día;
- semana;
- mes;
- franja;
- canal.

El ticket medio debería derivarse de ventas/tickets cuando sea posible, no duplicarse como verdad independiente.

---

# 8. Canales

Evitar strings inconsistentes repartidos por el producto:

- delivery;
- comer allí;
- takeaway;
- Auto;
- etc.

Crear un vocabulario interno/catálogo de canales cuando entre ventas.

Un proveedor externo se mapea al canal interno.

Ejemplo:

`STOREACE_DINE_IN` → `dine_in`

---

# 9. Tiempos de servicio

Modelo conceptual:

## service_time_metrics

- `restaurante_id`
- `metric_type`
- `interval_start`
- `interval_end`
- `value_seconds`
- `sample_count` cuando exista
- `channel` cuando aplique
- `source`

Tipos posibles:

- drive_thru_total;
- counter;
- kitchen;
- delivery;
- otros futuros.

Internamente guardar tiempos en una unidad consistente, preferiblemente segundos.

La interfaz puede mostrar `mm:ss`.

---

# 10. Personal / labor

Separar identidad de empleado de agregados operativos cuando sea necesario.

Para la primera versión de labor puede bastar con métricas agregadas:

## labour_metrics

- `restaurante_id`
- periodo;
- horas planificadas;
- horas trabajadas;
- coste laboral;
- número de personas cuando exista;
- fuente.

No almacenar información personal de empleados que no sea necesaria para el producto.

Si en el futuro se necesitan turnos individuales, deberán diseñarse con permisos y privacidad específicos.

---

# 11. Costes

Modelo conceptual:

## cost_metrics

- `restaurante_id`
- periodo;
- tipo de coste;
- importe;
- moneda;
- fuente.

Ejemplos:

- food_cost;
- labour_cost;
- otros costes operativos.

Los porcentajes se calculan en Domain usando numerador y denominador fiables.

Ejemplo:

`labor % = coste laboral / ventas relevantes`

No guardar únicamente el porcentaje si podemos conservar sus componentes.

---

# 12. Objetivos

Los objetivos pueden cambiar por:

- marca;
- restaurante;
- métrica;
- periodo.

Por ello, a futuro conviene un modelo con vigencia temporal.

## metric_targets

Conceptualmente:

- nivel de alcance: empresa / marca / restaurante;
- `metric_key`;
- valor objetivo;
- fecha desde;
- fecha hasta;
- unidad;
- metadata.

Ejemplos:

- rating objetivo = 4.4;
- Auto objetivo = 150 segundos.

Esto evita hardcodear para siempre todos los objetivos en la aplicación.

No migrar el objetivo 4.4 actual hasta que la capa de configuración esté preparada y probada.

---

# 13. KPIs y agregados

Los KPIs son resultados derivados.

Podemos tener:

- vistas;
- materialized views;
- tablas de agregado;
- caché.

Pero deben poder reconstruirse a partir de datos fuente normalizados, siempre que sea razonable.

Ejemplo:

```
sales_metrics
      ↓
Domain
      ↓
sales_daily_kpi
      ↓
dashboard
```

No diseñar:

```
dashboard_kpi
      ↓
única verdad disponible
```

---

# 14. Insights del Brain

No guardar un insight como si fuera un hecho.

Modelo conceptual futuro:

## insights

- restaurante / scope;
- periodo analizado;
- tipo;
- texto estructurado;
- evidencia utilizada;
- métricas relacionadas;
- nivel/confianza cuando tenga sentido;
- fecha de generación;
- versión del motor;
- estado: activo / resuelto / descartado.

Esto permitirá responder:

> ¿por qué Nexo me está diciendo esto?

---

# 15. Alertas

Una alerta es distinta de un insight.

## alerts

Conceptualmente:

- tipo;
- restaurante/scope;
- severidad;
- condición disparadora;
- evidencia;
- created_at;
- acknowledged_at;
- resolved_at;
- destinatarios/canal cuando sea necesario.

Una alerta debe poder evitar duplicados e identificar si ya fue enviada.

---

# 16. Auditoría

Cambios sensibles deberían ser auditables.

Ejemplos:

- cambios de permisos;
- objetivos;
- asignaciones;
- configuraciones;
- acciones administrativas.

No hace falta auditar cada clic.

---

# 17. Multi-tenant

Cada tabla operativa debe poder resolverse inequívocamente hasta el restaurante/empresa correspondiente.

Regla:

> nunca confiar en el frontend para decidir a qué tenant pertenece un dato.

La autorización se aplica en servidor y, progresivamente, también debe reforzarse a nivel de base de datos cuando sea viable.

---

# 18. Tiempo y zonas horarias

Los restaurantes pueden estar en ubicaciones distintas.

Principios:

- timestamps técnicos: almacenar de forma no ambigua;
- periodos de negocio: calcular usando la zona horaria del restaurante cuando sea relevante;
- no asumir eternamente `Europe/Madrid` para todas las ubicaciones;
- fechas de negocio y timestamps son conceptos distintos.

Este punto deberá abordarse antes de escalar a geografías con husos distintos.

---

# 19. Unidades

Normalizar internamente.

Ejemplos:

- tiempos → segundos;
- dinero → importe decimal + moneda;
- porcentajes → convención única;
- fechas → formato y timezone definidos.

La presentación puede transformar unidades, pero no redefinirlas.

---

# 20. Idempotencia

Una integración puede enviar el mismo dato más de una vez.

Cada pipeline debe poder responder:

> si recibo el mismo dato dos veces, ¿cómo evito duplicarlo?

Utilizar según el caso:

- external IDs;
- claves únicas;
- hashes;
- timestamps/versiones;
- idempotency keys.

---

# 21. Política de borrado

No borrar históricos operativos automáticamente porque un proveedor deje de devolver temporalmente un elemento.

Diferenciar:

- borrado real confirmado;
- dato oculto;
- dato no recibido;
- error de sincronización;
- entidad inactiva.

Especialmente importante para Google/reseñas.

---

# 22. Migraciones

Todos los cambios futuros de esquema deben:

1. estar versionados;
2. tener migración reproducible;
3. probarse fuera de producción;
4. preservar compatibilidad cuando sea necesario;
5. incluir rollback o plan de recuperación cuando el riesgo lo justifique;
6. actualizar la documentación.

No modificar producción manualmente y después intentar recordar qué se hizo.

---

# 23. Orden de introducción

No crear todas las tablas anteriores ahora.

Orden recomendado:

### Fase reputación
- documentar y estabilizar esquema actual;
- diseñar versionado de reseñas;
- reforzar uniones e identidad.

### Fase ventas
- external IDs;
- fuente StoreAce/TPV;
- sales_metrics;
- catálogo de canales.

### Fase tiempos
- service_time_metrics.

### Fase personal
- labour_metrics.

### Fase costes
- cost_metrics.

### Brain
- insights / alertas estructurados cuando realmente se necesiten.

---

# 24. Regla final

Antes de crear una tabla nueva, preguntar:

> ¿estoy almacenando un hecho, un agregado, una configuración o una interpretación?

Si no sabemos responderlo, el modelo todavía no está suficientemente definido.
