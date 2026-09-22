# Nexo Origen — Reglas de negocio comunes

## Propósito

Este documento define reglas que deben cumplirse en **todos los dominios de Nexo**.

Las reglas específicas de cada área viven en sus propios documentos:

- reputación → `REPUTATION.md`;
- ventas → futuro `SALES.md`;
- tiempos → futuro `SERVICE_TIMES.md`;
- personal → futuro `LABOUR.md`.

La idea central es:

> mismo dato + mismo periodo + mismo alcance = mismo resultado en cualquier interfaz.

---

# 1. Tipos de información

Nexo debe distinguir claramente estos conceptos.

## Hecho

Dato observado o recibido de una fuente.

Ejemplos:

- reseña de 2 estrellas;
- ventas de 2.340 €;
- 143 tickets;
- tiempo Auto de 252 segundos.

## Métrica

Cálculo determinista a partir de hechos.

Ejemplos:

- media de reseñas;
- ticket medio;
- labor %;
- tiempo medio.

## Objetivo

Valor contra el que se compara una métrica.

Ejemplos:

- reputación ≥ 4,4;
- Auto ≤ 150 segundos.

## Estado

Clasificación determinista respecto a una regla u objetivo.

Ejemplos:

- on_target;
- watch;
- critical.

## Patrón

Comportamiento repetido observado en datos.

## Correlación

Dos variables cambian de forma relacionada.

No implica causalidad.

## Hipótesis

Posible explicación apoyada por evidencia, pero no confirmada.

## Recomendación

Acción sugerida a partir de hechos, reglas e hipótesis.

---

# 2. Una sola fuente de verdad por cálculo

Una métrica importante debe tener una implementación canónica.

## Ubicación actual del calculador canónico

Para reputación, el calculador canónico de Nexo vive en el backend de la aplicación y se ejecuta en **Vercel**, no en el navegador ni en el ordenador de Tomás.

Entrada:
- hechos almacenados en Supabase (`resenas`, catálogo de restaurantes y fallbacks validados);

Implementación:
- `lib/reputation/canonical-metrics.server.ts`;
- reglas matemáticas compartidas en `lib/review-metrics.ts`.

Salida:
- métricas del periodo consumidas por Web, informes y resúmenes de agentes.

Supabase sigue siendo la fuente de verdad de los hechos. Vercel ejecuta las reglas deterministas de Nexo. Las interfaces no recalculan las métricas.

Prioridad actual de fuente para reputación:
1. reseñas canónicas/deduplicadas del periodo;
2. `kpi_diario` como fallback validado;
3. sin datos de periodo.

`dashboard_kpis` y `kpi_restaurantes` no deben sobrescribir las métricas numéricas canónicas de un periodo seleccionado.

No debe existir:

- una fórmula en Web;
- otra en PDF;
- otra en WhatsApp;
- otra dentro de un prompt.

Las interfaces consumen resultados, no redefinen reglas.

---

# 3. Sin datos no significa cero

Distinguir siempre:

- `0` = valor conocido igual a cero;
- `null/no_data` = no existe información suficiente;
- error de fuente = no pudimos obtener el dato.

Ejemplo:

0 reseñas en una semana es un hecho.

No haber cargado las reseñas de esa semana es otra situación totalmente distinta.

Nunca convertir un fallo de datos en rendimiento cero.

---

# 4. Periodos

Toda métrica temporal debe definir:

- inicio;
- fin;
- zona horaria;
- inclusión/exclusión de límites;
- granularidad.

En el sistema actual, los rangos de negocio son inclusivos por día.

Ejemplo:

`2026-09-07 → 2026-09-13`

incluye ambos días.

Actualmente la aplicación usa principalmente `Europe/Madrid`.

A futuro deberá poder respetar la zona horaria del restaurante cuando sea necesaria.

---

# 5. Comparaciones

Una comparación válida debe indicar:

- periodo actual;
- periodo comparado;
- métrica;
- alcance;
- unidad.

Preferir periodos equivalentes cuando sea posible.

Ejemplo correcto:

lunes-domingo actual vs lunes-domingo anterior.

Distinguir:

## Diferencia absoluta

`actual - anterior`

Ejemplo:

4,3 → 4,5 = +0,2 puntos.

## Cambio porcentual

`(actual - anterior) / anterior × 100`

Solo cuando tenga sentido.

Si el valor anterior es cero, no inventar un porcentaje infinito. Mostrar una representación explícita como “sin base comparable”.

---

# 6. Agregaciones

La forma de agregar depende de la métrica.

No utilizar automáticamente una media simple.

Ejemplo reputación:

si A tiene 100 reseñas con 4,5 y B tiene 2 reseñas con 3,0, la media de red no es:

`(4,5 + 3,0) / 2`

Debe ponderarse por número de reseñas.

Cada métrica futura debe documentar su regla de agregación.

---

# 7. Numerador y denominador

Todo porcentaje debe tener un denominador explícito.

Ejemplos:

- % negativas = negativas / total reseñas;
- labor % = coste laboral / ventas aplicables;
- conversión = eventos válidos / oportunidades válidas.

No utilizar un porcentaje si no podemos explicar exactamente de dónde salen ambas partes.

---

# 8. Precisión y redondeo

Los cálculos se hacen con la mayor precisión razonable.

El redondeo es principalmente una decisión de presentación.

Regla:

> no redondear valores intermedios si eso puede cambiar el resultado final o el estado.

Ejemplo:

una media real de 4,395 no debe convertirse primero a 4,4 y después clasificarse como objetivo cumplido si la regla compara el valor real.

Los documentos de cada dominio deben definir cualquier excepción.

---

# 9. Estados

Los estados deben depender de reglas explícitas.

Ejemplo:

- on_target;
- watch;
- critical;
- no_data.

No generar estados mediante lenguaje ambiguo de IA cuando existe una regla matemática.

La etiqueta visual puede cambiar, pero el significado interno debe permanecer estable.

---

# 10. Objetivos

Un objetivo debe tener:

- métrica;
- valor;
- unidad;
- alcance;
- vigencia.

No asumir que un objetivo será eterno.

A futuro los objetivos podrán variar por:

- empresa;
- marca;
- restaurante;
- periodo.

Mientras estén hardcodeados, deben existir en una única ubicación canónica.

---

# 11. Alcance

Toda consulta debe saber si habla de:

- restaurante;
- marca;
- empresa/red;
- conjunto autorizado de restaurantes.

La misma métrica puede agregarse de manera distinta según alcance, pero nunca debe incluir restaurantes fuera de los permisos del usuario.

---

# 12. Fuente y prioridad

Cuando una métrica pueda proceder de varias fuentes, hay que definir una prioridad explícita.

Ejemplo conceptual:

1. hechos individuales fiables;
2. agregado diario validado;
3. snapshot;
4. no_data.

No mezclar silenciosamente dos fuentes con semánticas diferentes dentro de la misma métrica.

Si se usa fallback, debe ser trazable.

---

# 13. Frescura

Una métrica debe poder indicar cuándo se actualizó.

Dato antiguo no equivale a mal rendimiento.

Conceptos diferentes:

- valor;
- periodo representado;
- momento de ingestión;
- última actualización.

Especialmente importante para ventas en tiempo real y alertas.

---

# 14. Calidad de datos

Antes de producir una conclusión, Nexo debe considerar:

- volumen;
- cobertura;
- datos faltantes;
- retraso de fuente;
- posibles duplicados;
- anomalías técnicas.

No presentar una conclusión fuerte basada en una muestra insuficiente sin señalarlo.

---

# 15. IA y cálculo

La IA puede:

- clasificar texto;
- resumir;
- encontrar patrones;
- proponer hipótesis;
- redactar recomendaciones.

La IA no debe ser responsable de:

- sumar;
- hacer medias;
- aplicar porcentajes;
- decidir semáforos definidos;
- controlar permisos;
- inventar datos faltantes.

---

# 16. Dato, patrón, hipótesis y causa

Nexo debe mantener estos niveles separados.

Ejemplo:

## Dato

El tiempo Auto subió de 2:40 a 3:20.

## Patrón

El aumento aparece repetidamente entre 20:00 y 22:00.

## Correlación

En esas franjas también suben tickets y quejas de espera.

## Hipótesis

Puede existir una limitación de capacidad en hora punta.

## Causa confirmada

Solo debe afirmarse cuando exista evidencia suficiente.

El Brain no debe saltar directamente de correlación a causa.

---

# 17. Evidencia de un insight

Un insight importante debe poder explicar:

- qué restaurantes analizó;
- qué periodo;
- qué métricas;
- qué valores;
- qué cambio/patrón detectó;
- qué fuente utilizó;
- qué parte es cálculo;
- qué parte es interpretación.

La respuesta “la IA lo ha decidido” no es suficiente.

---

# 18. Prioridad de problemas

Una prioridad futura puede combinar:

- severidad;
- frecuencia;
- tendencia;
- alcance;
- impacto económico;
- impacto cliente;
- persistencia.

No crear un “score mágico” sin fórmula documentada y validación.

---

# 19. Alertas

Una alerta debe responder a una condición clara.

Debe diferenciar:

- detectada;
- enviada;
- reconocida;
- resuelta.

Debe evitar repetir el mismo evento indefinidamente si nada ha cambiado.

---

# 20. Métricas derivadas

Siempre que sea posible, conservar componentes y derivar la métrica.

Preferir:

`ventas + tickets → ticket medio`

sobre almacenar únicamente:

`ticket medio`

Preferir:

`coste laboral + ventas → labor %`

sobre almacenar únicamente:

`labor %`

Esto permite recalcular y auditar.

---

# 21. Consistencia entre interfaces

Para el mismo usuario, scope y periodo:

- Web;
- WhatsApp;
- email;
- PDF;
- imagen;
- API

deben partir de los mismos resultados canónicos.

El formato puede cambiar.

El número no.

---

# 22. Regla de regresión

Antes de sustituir una lógica existente:

1. ejecutar la versión actual;
2. ejecutar la nueva;
3. comparar resultados con datos reales o fixtures;
4. explicar cualquier diferencia;
5. aceptar la migración solo cuando la diferencia sea intencionada.

No “arreglar” silenciosamente una regla histórica sin comprobar qué rompe.

---

# 23. Criterio para crear una nueva métrica

Antes de añadir una métrica, definir:

- nombre;
- pregunta de negocio que responde;
- fuente;
- fórmula;
- unidad;
- granularidad;
- alcance;
- tratamiento de no_data;
- objetivo si existe;
- regla de agregación;
- regla de comparación;
- test.

Si esto no está definido, todavía no está lista para ser una métrica oficial de Nexo.
