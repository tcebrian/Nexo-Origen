# Nexo Origen — Arquitectura

## 1. Objetivo de este documento

Este documento define **cómo debe organizarse Nexo** y dónde debe vivir cada tipo de responsabilidad.

No describe cada detalle del código. Para eso existen los documentos específicos de negocio, base de datos e integraciones.

La regla principal es:

> cada dato se guarda una vez, cada cálculo se define una vez y cada interfaz consume el mismo resultado.

---

# 2. Realidad actual

Nexo es actualmente una aplicación Next.js en un único repositorio.

No es todavía una arquitectura distribuida ni necesita serlo.

Áreas principales existentes:

- `app/` — páginas, componentes y route handlers de Next.js.
- `lib/auth/` — autenticación, roles, permisos y scope de datos.
- `lib/reviews/` — clasificación y lógica relacionada con reseñas.
- `lib/reports/` — generación de informes.
- `lib/restaurants/` — lógica y repositorios relacionados con restaurantes.
- `lib/supabase/` — acceso a datos en Supabase.
- `lib/notifications/` — notificaciones.
- `lib/prevent/`, `lib/ranking/`, `lib/dashboard/` — funcionalidades ya existentes.
- `supabase/` — SQL y soporte de esquema.
- `templates/` — plantillas visuales y de informes.

La estrategia correcta es **mejorar este monolito de forma modular**, no sustituirlo de golpe.

---

# 3. Arquitectura lógica objetivo

La arquitectura conceptual de Nexo es:

**Fuentes → Ingesta → Database → Domain → Brain → API → Interfaces**

Cada bloque tiene una responsabilidad diferente.

---

# 4. Fuentes

Son sistemas externos que producen información.

Ejemplos:

- Google / Apify;
- Google Business;
- StoreAce;
- TPV;
- delivery;
- horarios;
- fichajes;
- tiempos de servicio;
- WhatsApp;
- otras APIs.

Una fuente no debe dictar cómo funciona Nexo internamente.

Ejemplo:

StoreAce puede llamar a una métrica `net_sales`, mientras otro TPV la llama `revenue`.

Dentro de Nexo ambas deben convertirse en un concepto interno común.

---

# 5. Ingesta

La ingesta recibe datos externos y los convierte al modelo de Nexo.

Responsabilidades:

- validar;
- normalizar;
- identificar la fuente;
- conservar IDs externos;
- evitar duplicados;
- manejar versiones cuando sea necesario;
- registrar errores;
- guardar la información.

La ingesta **no decide** si un restaurante va bien o mal.

Eso pertenece a Domain o Brain.

---

# 6. Database

Supabase/PostgreSQL es la memoria operativa de Nexo.

Debe almacenar:

- entidades;
- relaciones;
- datos normalizados;
- históricos;
- resultados persistidos cuando tenga sentido;
- metadatos de origen.

Principio:

> la base de datos guarda hechos; no debe convertirse en una colección de lógica dispersa difícil de rastrear.

Puede haber vistas, funciones SQL o agregados cuando aporten rendimiento o consistencia, pero las reglas principales de negocio deben seguir siendo comprensibles y verificables desde el código.

---

# 7. Domain

Domain es el núcleo determinista de Nexo.

Aquí viven reglas y cálculos que, con los mismos datos, siempre deben producir el mismo resultado.

Ejemplos:

- media de reseñas;
- conteo de estrellas;
- positivas / neutras / negativas;
- estado respecto a objetivo;
- comparación entre periodos;
- ventas;
- ticket medio;
- labor %;
- tiempo medio;
- desviación respecto a objetivo.

## Regla

Si algo puede calcularse de forma fiable sin IA, debe resolverse aquí.

No usar IA para:

- sumar;
- hacer medias;
- calcular porcentajes;
- decidir un semáforo con umbrales conocidos;
- comparar números;
- aplicar una fórmula.

---

# 8. Brain

Brain interpreta.

Puede utilizar IA, heurísticas o algoritmos.

Responsabilidades futuras:

- detectar patrones;
- detectar anomalías;
- encontrar correlaciones;
- agrupar causas;
- explicar situaciones;
- generar hipótesis;
- proponer qué revisar;
- resumir grandes cantidades de información.

Ejemplo:

Domain puede calcular:

- ventas +19%;
- tickets +24%;
- tiempo Auto +31%;
- quejas por espera +46%.

Brain puede interpretar:

> existe una coincidencia entre mayor demanda y deterioro del tiempo de servicio; conviene revisar capacidad y dotación en las franjas de mayor volumen.

Brain no debe convertir una correlación en una causa confirmada sin evidencia suficiente.

---

# 9. API

La API es la puerta de entrada a las capacidades de Nexo.

Hoy puede seguir implementada mediante route handlers de Next.js en `app/api/`.

No necesitamos crear otro backend solo por arquitectura.

Ejemplos futuros:

- reputación de un restaurante;
- ventas;
- tiempos;
- personal;
- problemas;
- salud operativa;
- insights.

La API debe:

- autenticar;
- validar permisos;
- recibir parámetros;
- llamar a servicios / dominio;
- devolver resultados.

No debe contener grandes bloques de lógica de negocio.

---

# 10. Interfaces

Interfaces actuales o futuras:

- Web;
- WhatsApp;
- email;
- PDF;
- imágenes;
- app móvil;
- otros canales.

Las interfaces deben mostrar o solicitar información.

No deben redefinir cómo se calcula esa información.

Ejemplo incorrecto:

`Dashboard` calcula una media de una forma y `Informe PDF` de otra.

Ejemplo correcto:

ambos consumen el mismo cálculo central.

---

# 11. Mapa físico actual del repositorio

Mientras Nexo siga siendo un monolito modular, usaremos esta orientación:

## `app/`

Debe contener:

- páginas;
- layouts;
- componentes;
- route handlers;
- composición de interfaces.

Evitar introducir aquí fórmulas de negocio importantes.

---

## `lib/auth/`

Debe contener:

- roles;
- permisos;
- scopes;
- autorización;
- guards.

Es código sensible de seguridad.

No modificar sin comprobar aislamiento multiempresa.

---

## `lib/supabase/`

Debe contener:

- consultas;
- mapeo de filas;
- acceso a tablas/vistas;
- clientes Supabase;
- utilidades específicas de persistencia.

Regla:

> consulta datos, pero no debería decidir por sí sola qué significa el negocio.

---

## `lib/reviews/`

Actualmente contiene parte del dominio de reputación.

A corto plazo debe convertirse en el núcleo canónico de lógica de reseñas.

Puede contener:

- clasificación;
- deduplicación;
- reglas;
- transformaciones;
- tipos;
- helpers de dominio.

No debería contener UI.

---

## `lib/reports/`

Debe generar informes a partir de datos ya calculados.

Puede:

- componer PDFs;
- crear datasets para informes;
- construir nombres de archivo;
- preparar tablas;
- renderizar plantillas.

No debería crear una segunda versión de las reglas de reputación.

---

## `lib/notifications/`

Debe encargarse de distribución:

- preparar eventos;
- decidir canal según configuración;
- enviar notificaciones.

No debería recalcular KPIs.

---

## `templates/`

Solo presentación.

Puede contener:

- componentes visuales;
- CSS;
- layouts de marca;
- recursos de plantilla.

No debe contener reglas empresariales independientes.

---

# 12. Regla para nueva funcionalidad

Antes de programar algo nuevo hay que responder:

1. ¿Cuál es la fuente?
2. ¿Cómo entra el dato?
3. ¿Dónde se guarda?
4. ¿Cuál es la representación interna?
5. ¿Qué cálculo determinista necesita?
6. ¿Necesita interpretación?
7. ¿Qué permisos aplican?
8. ¿Cómo se expone?
9. ¿Qué interfaces lo consumen?
10. ¿Cómo se prueba?

Si no sabemos responder estas preguntas, todavía no debemos empezar por la pantalla.

---

# 13. Ejemplo real — Reputación

Flujo objetivo:

Google / Apify  
↓  
ingesta externa  
↓  
Supabase `resenas`  
↓  
`lib/supabase/` obtiene los datos  
↓  
`lib/reviews/` / dominio calcula  
↓  
Brain / análisis interpreta cuando hace falta  
↓  
API / servicios  
↓  
Web / informes / alertas / WhatsApp

Regla:

una media, conteo o estado no debe recalcularse de forma distinta en cada canal.

---

# 14. Ejemplo futuro — Ventas

Flujo:

StoreAce / TPV  
↓  
integración de ventas  
↓  
normalización  
↓  
tabla(s) de ventas  
↓  
dominio de ventas  
↓  
API  
↓  
Web / informes / Brain

Después:

ventas + tiempos + reseñas  
↓  
Brain  
↓  
insight operativo

No conectar StoreAce directamente a una gráfica como solución permanente.

---

# 15. Ejemplo — Informes

Flujo correcto:

usuario solicita informe  
↓  
backend valida permisos  
↓  
obtiene métricas ya calculadas  
↓  
`lib/reports/` compone el documento  
↓  
PDF / imagen

El informe no debe inventar sus propios KPIs.

---

# 16. Ejemplo — WhatsApp

Flujo correcto:

mensaje de usuario  
↓  
identificación y permisos  
↓  
interpretación de intención  
↓  
consulta a Nexo  
↓  
respuesta

WhatsApp es una interfaz.

No debe convertirse en un sistema paralelo con cálculos propios.

---

# 17. Seguridad

Actualmente una parte importante del aislamiento multiempresa depende del código de aplicación.

Especial atención a:

- `lib/auth/scopes.ts`;
- `lib/auth/data-scope.ts`;
- repositorios Supabase;
- route handlers con información sensible.

Reglas:

- ocultar algo en la interfaz no es seguridad;
- el servidor debe comprobar acceso;
- no confiar en un `restaurant_id` enviado por el navegador sin validar scope;
- secretos solo en entornos seguros;
- nunca exponer service role al cliente.

En el futuro podremos reforzar RLS, pero no debemos romper el aislamiento actual durante la transición.

---

# 18. Procesos pesados

No todo necesita worker hoy.

Una tarea debería salir del request normal cuando presente problemas como:

- tarda demasiado;
- necesita reintentos;
- procesa muchos elementos;
- llama a IA masivamente;
- genera informes pesados;
- necesita programarse;
- no debe perderse si falla el navegador.

Cuando eso sea real, introduciremos workers / colas.

Hasta entonces no añadiremos infraestructura por moda.

---

# 19. Make / n8n

Make o n8n pueden seguir siendo útiles para:

- disparadores;
- conectores;
- flujos sencillos;
- integración entre herramientas.

No deben ser la única ubicación de reglas críticas de Nexo.

Objetivo:

Make / n8n  
↓  
llama o alimenta Nexo  
↓  
Nexo aplica las reglas

Evitar:

Make / n8n  
↓  
decenas de filtros  
↓  
cálculos empresariales  
↓  
reglas duplicadas  
↓  
IA  
↓  
resultado diferente al Web

---

# 20. Estrategia de migración

No habrá big bang.

Para cada dominio:

1. localizar dónde se calcula hoy;
2. identificar duplicados;
3. elegir una implementación canónica;
4. documentarla;
5. añadir tests;
6. conectar una interfaz;
7. verificar paridad;
8. conectar el resto;
9. retirar duplicados antiguos.

Primera vertical: reputación.

---

# 21. Cuándo crear nuevos servicios

No crear microservicios solo por “hacer arquitectura”.

Un servicio separado se justifica cuando exista una necesidad concreta:

- escalado independiente;
- colas;
- procesos largos;
- alta frecuencia;
- aislamiento;
- seguridad;
- despliegue independiente;
- integración especializada.

Hasta entonces:

> monolito modular primero.

---

# 22. Criterios de una buena decisión arquitectónica

Una solución es buena cuando:

- existe una fuente de verdad clara;
- las interfaces comparten reglas;
- puede probarse;
- puede cambiarse sin romper todo;
- los proveedores externos pueden sustituirse;
- los permisos se aplican de forma consistente;
- el código refleja el dominio del restaurante;
- no requiere conocer cinco herramientas diferentes para entender un cálculo.

---

# 23. Señales de alarma

Antes de aprobar una implementación, parar si aparece alguno de estos patrones:

- misma fórmula copiada en varios archivos;
- componente React haciendo cálculos empresariales complejos;
- consulta directa a Supabase desde muchos lugares distintos para el mismo concepto;
- WhatsApp y Web obteniendo resultados diferentes;
- lógica crítica solo dentro de Make;
- prompt de IA calculando KPIs;
- secretos en código;
- acceso a datos basado únicamente en ocultar botones;
- migración grande sin comparación con el sistema actual;
- nuevo servicio sin una necesidad operativa real.
