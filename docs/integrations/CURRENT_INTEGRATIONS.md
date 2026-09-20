# Nexo Origen — Integraciones actuales

## Propósito

Este documento describe **qué integraciones existen hoy o están parcialmente implementadas** y qué papel cumplen.

Para las reglas que debe seguir cualquier integración nueva, leer también:

`INTEGRATION_RULES.md`

No confundir integraciones actuales con integraciones planificadas.

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
- datos necesarios para informes y alertas.

## Responsabilidad

Supabase almacena datos y sirve como base operativa de Nexo.

No debe convertirse en un sustituto del Domain o Brain.

## Seguridad

Existen dos niveles de acceso:

### Cliente

Usa credenciales públicas compatibles con navegador.

### Servidor

Puede utilizar `SUPABASE_SERVICE_ROLE_KEY`.

La service role:

- nunca debe exponerse al navegador;
- nunca debe incluirse en Git;
- debe utilizarse únicamente desde código server-only.

---

# 2. Ingesta externa de reseñas

## Estado

**ACTIVA FUERA DE ESTE REPOSITORIO**

Las reseñas y snapshots públicos de Google llegan a Supabase mediante un proceso externo.

El dashboard actual consume esos datos, pero el pipeline completo de scraping/ingesta no vive todavía en este repositorio.

## Datos consumidos

Principalmente:

- reseñas individuales;
- estrellas;
- autor;
- comentario;
- fechas;
- restaurante;
- identificador externo;
- media Google;
- total de reseñas Google.

## Riesgo actual

Nexo depende de que ese proceso externo respete:

- identidad de reseña;
- deduplicación;
- ediciones;
- asociación restaurante;
- fechas.

La futura capa de ingesta debe convertir estas reglas en un pipeline explícito y auditable.

---

# 3. Twilio / WhatsApp — envío de alertas

## Estado

**IMPLEMENTADO EN EL REPOSITORIO**

El proyecto incluye la dependencia `twilio` y código para enviar alertas de WhatsApp.

Archivos principales actuales:

- `lib/notifications/whatsapp.ts`
- `app/api/webhooks/new-resena-whatsapp/route.ts`
- `app/api/notifications/whatsapp-alert-image/route.ts`
- `lib/notifications/build-alert-for-resena.ts`

Variables de entorno documentadas:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `WHATSAPP_WEBHOOK_SECRET`

Los valores reales nunca deben estar en Git.

---

# 4. Flujo actual de alerta WhatsApp

Flujo aproximado actual:

```
nueva reseña
   ↓
Supabase / evento externo
   ↓
POST /api/webhooks/new-resena-whatsapp
   ↓
validación de secreto
   ↓
consulta restaurante/empresa
   ↓
deduplicación de envío
   ↓
generación de imagen
   ↓
Twilio
   ↓
WhatsApp
```

El endpoint de imagen genera un PNG accesible temporalmente para que Twilio pueda descargarlo.

---

# 5. Deuda conocida — criterio de reseña negativa

La regla oficial documentada de reputación es:

- negativa = 1–2 estrellas;
- neutral = 3 estrellas.

Sin embargo, el webhook actual de WhatsApp utiliza:

`estrellas <= 3`

para decidir qué alertas enviar.

Esto es una discrepancia conocida.

No corregir de forma aislada sin revisar:

- qué esperan los usuarios actuales;
- alertas ya configuradas;
- informes;
- lógica de motivos;
- tests.

La futura migración debe hacer que el webhook consuma la regla canónica del dominio en lugar de mantener su propia definición.

---

# 6. Deuda conocida — destinatarios de WhatsApp

El webhook actual contiene configuración de destinatarios en código.

Esto no debe escalar así.

Dirección futura:

```
usuario / configuración
      ↓
permisos y suscripciones
      ↓
reglas de notificación
      ↓
canal WhatsApp
```

Los destinatarios deberían depender de configuración persistida y permisos, no de editar y desplegar código.

---

# 7. Deuda conocida — deduplicación de alertas

El webhook consulta una tabla de envíos para evitar reenviar la misma reseña.

La idea es correcta:

> una reejecución del webhook no debe duplicar la alerta.

A futuro la deduplicación debería formar parte de un modelo de alertas/notificaciones común y no ser exclusiva de este webhook.

Debe poder registrar, según necesidad:

- alerta;
- destinatario;
- canal;
- estado de envío;
- intento;
- identificador del proveedor;
- fecha;
- error.

---

# 8. Deuda conocida — autenticación del recurso multimedia

El endpoint que genera la imagen utiliza actualmente un token derivado del secreto compartido del webhook en la URL.

Funciona como protección básica, pero no es el diseño final deseable.

Dirección futura:

- URL firmada;
- token específico;
- expiración corta;
- o almacenamiento temporal privado/presignado.

No reutilizar indefinidamente un secreto global como credencial de recursos externos.

---

# 9. WhatsApp conversacional / bot

## Estado

**PARCIAL / EXTERNO AL REPOSITORIO**

Nexo también contempla WhatsApp como interfaz conversacional.

Conceptualmente:

```
usuario WhatsApp
   ↓
proveedor/API WhatsApp
   ↓
identidad + permisos
   ↓
Nexo API / Domain / Brain
   ↓
respuesta
```

WhatsApp no debe tener una copia independiente de:

- medias;
- rankings;
- problemas;
- permisos;
- comparativas.

Debe consultar Nexo.

Si Make u otra plataforma participa como transporte/orquestación, no debe convertirse en la fuente de verdad.

---

# 10. Vercel

## Estado

**CONFIGURADO**

El repositorio contiene configuración de despliegue para Vercel.

Vercel aloja/ejecuta la aplicación, pero no es una capa de negocio.

Reglas:

- producción no es entorno de pruebas;
- secretos mediante variables de entorno;
- cambios importantes deben pasar por rama/PR;
- una integración no debe depender de archivos locales del ordenador de Tomás.

---

# 11. IA

## Estado

**PRESENTE EN EL PRODUCTO**

Nexo consume/almacena resultados de análisis IA asociados a reseñas.

La integración concreta con proveedor/modelo puede evolucionar.

Principio:

> el proveedor de IA es sustituible; el dominio de Nexo no debe depender de una marca/modelo concreto.

IA:

- interpreta;
- clasifica;
- resume;
- genera hipótesis/recomendaciones.

IA no:

- controla permisos;
- calcula KPIs deterministas;
- es la única copia del dato;
- inventa datos ausentes.

---

# 12. Make / n8n

## Estado

**HERRAMIENTAS EXTERNAS DE ORQUESTACIÓN**

Pueden utilizarse para:

- conectar servicios;
- disparar webhooks;
- automatizaciones sencillas;
- notificaciones;
- sincronizaciones.

No deben contener la única implementación de reglas críticas.

Dirección:

```
Make / n8n
    ↓
evento o llamada
    ↓
Nexo
    ↓
regla canónica
```

Evitar:

```
Make
├── regla de negativas
├── cálculo de media
├── permisos
├── ranking
└── lógica distinta de Web
```

---

# 13. Google Business

## Estado

**PLANIFICADO / INTEGRACIÓN FUTURA**

Puede aportar en el futuro:

- perfiles oficiales;
- reseñas;
- respuestas;
- datos de negocio disponibles mediante API;
- sincronización autorizada por el cliente.

Cuando se incorpore, debe mapearse al modelo interno de Nexo.

Google no debe convertirse en la identidad primaria del restaurante.

---

# 14. StoreAce / TPV

## Estado

**PLANIFICADO**

StoreAce u otros sistemas de venta podrán ser fuentes de:

- ventas;
- tickets;
- canales;
- franjas;
- otros datos operativos disponibles.

Flujo objetivo:

```
StoreAce
   ↓
adaptador
   ↓
modelo normalizado Nexo
   ↓
Supabase
   ↓
Domain ventas
   ↓
API / Brain
   ↓
Web · WhatsApp · Informes
```

No conectar el proveedor directamente a componentes visuales como arquitectura permanente.

---

# 15. Sistemas de tiempos

## Estado

**PLANIFICADO**

Posibles fuentes:

- sistemas Auto / drive-thru;
- cocina;
- mostrador;
- delivery;
- otras herramientas operativas.

Deben normalizar:

- restaurante;
- tipo de métrica;
- periodo/franja;
- valor;
- unidad;
- volumen/muestra cuando exista;
- proveedor.

---

# 16. Sistemas de personal

## Estado

**PLANIFICADO**

Posibles fuentes:

- horarios;
- fichaje;
- workforce management;
- costes laborales.

Principio:

recoger únicamente la información personal necesaria para el producto.

La primera versión puede funcionar con métricas agregadas sin almacenar información individual innecesaria.

---

# 17. Delivery

## Estado

**PLANIFICADO**

Las plataformas delivery pueden aportar:

- ventas;
- pedidos;
- tiempos;
- cancelaciones;
- incidencias;
- mix de canal.

La semántica externa deberá mapearse al vocabulario interno de Nexo.

---

# 18. Matriz actual

| Integración | Estado | Rol |
|---|---|---|
| Supabase | Activa | Backend / base operativa |
| Ingesta reseñas | Activa, externa | Fuente reputación |
| Twilio WhatsApp | Implementada | Canal de salida |
| WhatsApp conversacional | Parcial/externo | Interfaz |
| Vercel | Configurado | Hosting/runtime |
| IA | Activa/parcial | Interpretación |
| Make/n8n | Externo | Orquestación |
| Google Business | Futuro | Fuente/acción oficial |
| StoreAce/TPV | Futuro | Fuente ventas |
| Tiempos | Futuro | Fuente operativa |
| Personal | Futuro | Fuente labor |
| Delivery | Futuro | Fuente operativa/ventas |

---

# 19. Regla principal

Ninguna integración debe convertirse en “el cerebro” de Nexo.

Los proveedores:

> entregan o reciben datos.

Nexo:

> identifica, normaliza, calcula, autoriza, interpreta y distribuye.
