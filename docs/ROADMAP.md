# Nexo Origen — Roadmap

Este archivo indica **dónde estamos, qué viene después y qué condición debe cumplirse antes de avanzar**.

No es un registro de sesiones. Para histórico técnico existe `PROGRESS.md`.

---

## FASE 0 — Foundation

### Objetivo

Hacer que el Nexo actual sea más seguro, mantenible y fácil de evolucionar por humanos y agentes de IA.

### Trabajo

- documentación corta y especializada;
- responsabilidades claras entre UI, datos y negocio;
- límites explícitos de acceso a datos;
- preservar autenticación y tenant scoping;
- reducir cálculos duplicados;
- definir una ruta de migración segura;
- dejar `PROGRESS.md` como histórico, no como contexto obligatorio;
- mejorar tests de reglas críticas;
- documentar decisiones arquitectónicas importantes.

### Criterio de salida

No pasamos a la siguiente fase hasta que:

- la arquitectura actual esté documentada;
- las reglas de reputación importantes tengan una ubicación clara;
- sepamos qué código es fuente de verdad;
- los cambios no alteren el comportamiento actual;
- exista una forma fiable de validar cambios.

### Estado

**EN CURSO — documentación base completada; hardening técnico iniciado**

---

## FASE 1 — Reputación como primer dominio completo

### Objetivo

Convertir reputación en la primera vertical totalmente estructurada de Nexo.

### Trabajo

- centralizar medias y conteos;
- centralizar objetivo y estados;
- centralizar comparativas;
- documentar deduplicación y reseñas editadas;
- separar acceso a datos de cálculos;
- hacer que Web, informes, alertas y WhatsApp consuman la misma lógica;
- añadir tests a cálculos críticos.

### Criterio de salida

La fase termina cuando:

- un mismo periodo produce exactamente los mismos resultados en todos los canales;
- no existen fórmulas importantes duplicadas;
- las reglas tienen tests;
- podemos comparar el sistema nuevo con el comportamiento actual sin diferencias inesperadas.

---

## FASE 2 — Ventas

### Objetivo

Añadir ventas como segundo dominio operativo.

### Datos iniciales

- ventas;
- tickets;
- ticket medio;
- canales;
- ventas por hora/franja;
- objetivos;
- comparativas.

### Regla

No construir cálculos de ventas directamente dentro de componentes del dashboard.

### Criterio de salida

Nexo puede responder de forma consistente:

- cuánto se vende;
- cómo evoluciona;
- por qué canal;
- con qué volumen de tickets;
- en qué franjas existe mayor presión.

---

## FASE 3 — Tiempos de servicio

### Objetivo

Añadir el rendimiento operativo del servicio.

### Datos

- Auto / drive-thru;
- mostrador;
- delivery;
- otros tiempos disponibles;
- objetivos;
- comparativas;
- franjas horarias.

### Criterio de salida

Nexo puede detectar desviaciones de tiempo por restaurante, periodo y franja con datos trazables.

---

## FASE 4 — Personal

### Objetivo

Relacionar demanda y capacidad.

### Datos

- horas planificadas/trabajadas;
- dotación por franja;
- coste laboral;
- labor %;
- productividad.

### Criterio de salida

Nexo puede comparar carga operativa con recursos humanos sin depender de cálculos manuales externos.

---

## FASE 5 — Nexo Brain cruzando dominios

### Objetivo

Empezar a detectar relaciones entre áreas.

Ejemplos:

- ventas vs tiempos;
- personal vs tiempos;
- tiempos vs quejas;
- mix de ventas vs presión operativa;
- problemas repetidos entre restaurantes.

### Regla

Una correlación no debe presentarse automáticamente como causa.

El Brain debe diferenciar:

- dato;
- patrón;
- correlación;
- hipótesis;
- recomendación.

### Criterio de salida

Cada insight importante debe poder explicar:

- qué datos utilizó;
- qué periodo analizó;
- qué patrón encontró;
- qué nivel de certeza tiene;
- qué debería revisar una persona.

---

## FASE 6 — Recomendaciones, alertas y predicción

### Objetivo

Pasar de análisis reactivo a ayuda operativa anticipada.

Posibles capacidades:

- anomalías;
- riesgos;
- saturación;
- desviaciones;
- tendencias;
- recomendaciones priorizadas;
- predicciones cuando exista suficiente histórico.

---

## Infraestructura futura

Workers, colas, servicios API separados o infraestructura adicional solo se incorporarán cuando exista una necesidad real, por ejemplo:

- procesos largos;
- reintentos;
- gran volumen;
- tareas programadas;
- aislamiento;
- escalado independiente.

Evitar microservicios prematuros.

---

## Regla para priorizar

Antes de empezar una función nueva preguntamos:

> ¿Esta función hace que Nexo entienda mejor el restaurante o solo añade otra pantalla?

Si solo añade otra pantalla con lógica independiente, no es prioridad.
