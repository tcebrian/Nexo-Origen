# Nexo Origen — Integraciones actuales

## Propósito

Este documento describe el estado **real verificado** de las integraciones de Nexo a fecha actual.

Para reglas de diseño de cualquier integración nueva, leer también:

`INTEGRATION_RULES.md`

Principio:

> Make puede orquestar y transportar. Nexo debe acabar siendo quien define las reglas, permisos y cálculos.

---

# 1. Supabase

## Estado

**ACTIVO / CENTRAL**

Supabase es actualmente el backend principal de Nexo.

Se utiliza para:

- autenticación;
- perfiles;
- empresas;
- marcas;
- restaurantes;
- reseñas;
- KPIs;
- análisis IA persistidos;
- permisos/asignaciones;
- datos necesarios para web, informes y automatizaciones.

## Regla

Supabase almacena la realidad.

No debe convertirse en sustituto del dominio de Nexo ni contener lógica duplicada entre consumidores.

---

# 2. Apify + Make — ingesta de reseñas

## Estado

**ACTIVO / PRODUCCIÓN EXTERNA AL REPOSITORIO**

El flujo activo verificado actualmente es:

```
Google Maps
   ↓
Apify
   ↓
Make
   ↓
Supabase
```

El escenario activo de Make:

`Nexo Origen (copy)`

parte de resultados de Apify y procesa las reseñas.

## Flujo de reseña nueva

De forma simplificada:

```
Apify
  ↓
Make
  ↓
buscar review_id en Supabase
  ↓
si es nueva
  ↓
guardar en resenas
  ↓
análisis IA
  ↓
guardar analisis_ia
  ↓
si requiere atención
  ↓
notificaciones
```

La identidad principal utilizada para guardar la reseña es `review_id`.

## Flujo de reseña editada

Make también contiene una ruta específica para detectar cambios en una reseña ya conocida.

Actualmente compara, entre otros:

- estrellas;
- comentario.

Cuando detecta una edición:

```
reseña existente
   ↓
PATCH resenas
   ↓
nuevo análisis IA
   ↓
upsert analisis_ia
```

Esta lógica sigue estando fuera del repositorio.

---

# 3. WhatsApp de alertas — flujo activo real

## Estado

**ACTIVO EN MAKE**

El canal activo verificado para notificaciones utiliza:

**WhatsApp Business Cloud desde Make**

No depende actualmente del webhook Twilio del repositorio como camino principal.

El escenario `Nexo Origen (copy)` contiene una rama de notificación para reseñas de atención.

Actualmente la regla de entrada de esa rama es equivalente a:

`estrellas <= 3`

Después Make puede distribuir la alerta por canales como:

- email;
- WhatsApp Business Cloud.

## Semántica

La semántica de dominio de Nexo queda separada:

- 1–2★ = negativa KPI;
- 3★ = neutral KPI;
- 1–3★ = requiere atención.

Por tanto, la rama actual de Make debe entenderse como:

> reseñas que requieren atención

y no como definición del KPI oficial de negativas.

---

# 4. Código Twilio / WhatsApp dentro del repositorio

## Estado

**IMPLEMENTADO, PERO NO ES EL FLUJO ACTIVO PRINCIPAL VERIFICADO**

El repositorio contiene:

- `lib/notifications/whatsapp.ts`;
- `app/api/webhooks/new-resena-whatsapp/route.ts`;
- `app/api/notifications/whatsapp-alert-image/route.ts`;
- `lib/notifications/build-alert-for-resena.ts`.

También documenta variables como:

- `TWILIO_ACCOUNT_SID`;
- `TWILIO_AUTH_TOKEN`;
- `TWILIO_WHATSAPP_FROM`;
- `WHATSAPP_WEBHOOK_SECRET`.

Este código no debe asumirse como el canal productivo actual únicamente porque exista en Git.

Hasta que se decida migrar hacia él o retirarlo, tratarlo como:

- flujo alternativo;
- implementación anterior;
- o infraestructura preparada.

No modificarlo para cambiar el comportamiento real de WhatsApp sin comprobar primero Make.

---

# 5. WhatsApp conversacional / bot

## Estado

**ACTIVO EN MAKE**

El escenario activo verificado es:

`Integration WhatsApp Business Cloud`

Flujo aproximado:

```
usuario WhatsApp
   ↓
WhatsApp Business Cloud
   ↓
Make
   ↓
memoria diaria en Supabase
   ↓
OpenAI
   ↓
consulta validada a Supabase
   ↓
OpenAI
   ↓
Make
   ↓
WhatsApp
   ↓
guardar respuesta
```

Actualmente Make participa tanto en la orquestación como en parte de la lógica del asistente.

## Dirección futura

El bot no debe mantener su propia definición de:

- medias;
- rankings;
- periodos;
- negativas;
- permisos;
- restaurantes accesibles.

Objetivo:

```
WhatsApp
   ↓
Make
   ↓
Nexo API
   ↓
Auth / permisos
   ↓
Domain
   ↓
datos calculados
   ↓
Brain / explicación
   ↓
Make
   ↓
WhatsApp
```

Make continúa siendo útil, pero pasa a actuar principalmente como adaptador/orquestador.

---

# 6. IA

## Estado

**ACTIVA**

Los escenarios actuales de Make utilizan IA para analizar reseñas y para el bot conversacional.

Además, Nexo persiste análisis asociados a reseñas en `analisis_ia`.

Principio:

> la IA interpreta; no debe ser la fuente de verdad de un KPI determinista.

La IA puede:

- resumir;
- clasificar motivos;
- interpretar;
- recomendar;
- generar explicaciones.

No debe decidir por sí sola:

- permisos;
- identidad de restaurante;
- cálculo de medias;
- conteos oficiales;
- reglas de acceso.

---

# 7. Make — papel actual

## Estado

**ACTIVO Y CRÍTICO EN LA V1**

Hoy Make realiza más que simple transporte.

Entre otras cosas participa en:

- ingesta desde Apify;
- comprobación de existencia de reseñas;
- altas y actualizaciones en Supabase;
- disparo de IA;
- persistencia de análisis;
- filtros de atención;
- email;
- WhatsApp;
- bot conversacional;
- memoria diaria del bot.

Eso es válido para la fase actual de Nexo.

## Limitación

Si una regla crítica solo existe en Make, Web y Make pueden divergir.

Ejemplo:

```
Web:
3★ = neutral KPI

Make:
<=3★ = enviar alerta
```

Ambos comportamientos pueden ser correctos, pero deben compartir vocabulario:

- neutral KPI;
- seguimiento operativo.

---

# 8. Seguridad actual de Make

Los escenarios activos hacen llamadas HTTP directas a Supabase con credenciales server-side.

Reglas:

- esas credenciales nunca deben llegar al navegador;
- no deben copiarse a prompts, documentación o Git;
- no deben multiplicarse por módulos/escenarios sin necesidad;
- a medio plazo es preferible que Make llame a endpoints server-side de Nexo en lugar de tener acceso amplio directo a Supabase.

Dirección:

```
Make
  ↓
endpoint autenticado de Nexo
  ↓
validación
  ↓
permisos
  ↓
Supabase
```

Esto permite reducir superficie de acceso y centralizar auditoría.

---

# 9. Deuda detectada en deduplicación de alertas Make

La ruta activa de alertas utiliza una tabla de control para evitar duplicados.

Durante la revisión se ha detectado una inconsistencia que debe verificarse antes de modificar producción:

- la reseña se identifica/guarda usando `reviewId`;
- una parte del control de alertas referencia `reviewerId`.

No asumir que ambos identificadores significan lo mismo.

Antes de tocar el escenario:

1. verificar qué devuelve exactamente Apify para ambos campos;
2. confirmar la clave única real de la tabla de alertas;
3. probar una reseña repetida;
4. corregir solo después.

No se ha modificado el escenario activo en esta fase.

---

# 10. Destinatarios y permisos de WhatsApp

Actualmente existen filtros/destinatarios configurados dentro de Make.

Esto es aceptable para una V1 con pocos usuarios.

No escala como modelo definitivo.

Objetivo:

```
usuario
  ↓
perfil + teléfono
  ↓
empresa / marca / restaurante permitido
  ↓
suscripciones de notificación
  ↓
canal
```

La configuración debe acabar viviendo en Nexo/Supabase y Make debería recibir la decisión ya resuelta.

---

# 11. Vercel

## Estado

**CONFIGURADO**

Vercel aloja/ejecuta la aplicación web y API del repositorio.

Reglas:

- producción no es entorno de pruebas;
- secretos mediante variables de entorno;
- cambios importantes por rama/PR;
- ninguna integración debe depender del ordenador local de Tomás.

---

# 12. Arquitectura recomendada de transición

No hay que eliminar Make ahora.

## Fase actual

```
Apify
  ↓
Make
  ├── lógica
  ├── IA
  ├── Supabase
  └── WhatsApp
```

Funciona y permite validar rápido.

## Próxima evolución

```
Apify
  ↓
Make
  ↓
Nexo API
  ↓
Domain
  ↓
Supabase
  ↓
resultado / evento
  ↓
Make
  ↓
WhatsApp / email
```

Make conserva:

- conectores;
- disparadores;
- entrega;
- automatizaciones externas.

Nexo gana:

- reglas;
- permisos;
- cálculo;
- semántica;
- trazabilidad.

## Futuro, solo si compensa

Algunos canales podrían salir directamente desde Nexo sin Make.

No hacerlo por principio.

Solo migrar cuando reduzca complejidad, coste o riesgo.

---

# 13. Google Business

## Estado

**PLANIFICADO**

Puede aportar:

- perfiles oficiales;
- reseñas;
- respuestas;
- datos autorizados del negocio.

Debe mapearse al modelo interno de Nexo.

---

# 14. StoreAce / TPV

## Estado

**PLANIFICADO**

Puede aportar:

- ventas;
- tickets;
- canales;
- franjas;
- otros datos operativos disponibles.

Objetivo:

```
StoreAce / TPV
   ↓
adaptador
   ↓
modelo Nexo
   ↓
Supabase
   ↓
Domain ventas
   ↓
Brain / API
   ↓
Web · WhatsApp · Informes
```

---

# 15. Tiempos, personal y delivery

## Estado

**PLANIFICADO**

Futuros conectores deberán normalizar datos de:

- Auto / drive-thru;
- cocina;
- mostrador;
- delivery;
- horarios;
- fichajes;
- coste laboral;
- pedidos;
- cancelaciones;
- incidencias.

No conectar una fuente externa directamente a una pantalla como arquitectura permanente.

---

# 16. Matriz real actual

| Integración | Estado | Rol actual |
|---|---|---|
| Supabase | Activa | Backend / fuente operativa |
| Apify | Activa | Extracción de reseñas |
| Make | Activo / crítico | Ingesta, orquestación, IA y notificaciones |
| WhatsApp Business Cloud | Activo vía Make | Alertas + bot |
| OpenAI en Make | Activo | Análisis / interpretación |
| Email | Activo vía Make | Notificaciones |
| Twilio en repo | Implementado, no confirmado como flujo activo | Alternativa / código existente |
| Vercel | Configurado | Web / API runtime |
| Google Business | Futuro | Integración oficial |
| StoreAce / TPV | Futuro | Ventas |
| Tiempos | Futuro | Operativa |
| Personal | Futuro | Labor |
| Delivery | Futuro | Operativa / ventas |

---

# 17. Regla principal

La arquitectura actual de Make es válida para la V1.

La evolución deseada es:

> **Make conecta. Supabase guarda. Nexo decide. Brain interpreta. Las interfaces muestran o ejecutan.**

No es necesario reescribir lo que funciona.

La migración debe hacerse regla por regla, manteniendo paridad y con posibilidad de volver atrás.
