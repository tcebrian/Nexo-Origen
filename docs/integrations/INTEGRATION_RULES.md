# Nexo Origen — Reglas de integraciones

## Propósito

Este documento define cómo debe construirse cualquier integración nueva.

Aplica a:

- Google;
- Apify/scrapers;
- StoreAce;
- TPVs;
- WhatsApp;
- Twilio;
- delivery;
- horarios;
- fichajes;
- tiempos;
- Make/n8n;
- futuras APIs.

---

# 1. Regla fundamental

Una integración es un **adaptador**, no una capa de negocio.

Su trabajo es traducir:

```
lenguaje del proveedor
        ↓
modelo interno Nexo
```

y, en sentido contrario:

```
acción Nexo
   ↓
adaptador
   ↓
proveedor
```

---

# 2. No filtrar lógica crítica por proveedor

Ejemplo incorrecto:

StoreAce decide si las ventas son buenas o malas.

Ejemplo correcto:

StoreAce entrega ventas.

Nexo Domain compara esas ventas con:

- periodo;
- objetivo;
- histórico;
- contexto.

---

# 3. Adaptadores sustituibles

El dominio no debe depender directamente de nombres o estructuras de un proveedor.

Ejemplo:

`STOREACE_DINE_IN`

se normaliza a un canal Nexo como:

`dine_in`

Si mañana cambia el TPV, el resto del producto no debería necesitar una reescritura.

---

# 4. Identificadores externos

Cada integración debe preservar el ID externo necesario para:

- deduplicar;
- reconciliar;
- actualizar;
- auditar.

Pero el ID externo no sustituye al ID interno de Nexo.

Utilizar el modelo de correspondencias definido en:

`docs/database/DATA_MODEL.md`

---

# 5. Idempotencia

Toda ingesta o webhook debe responder:

> ¿qué ocurre si recibo exactamente el mismo evento dos veces?

El resultado correcto normalmente es:

- un único hecho;
- un único efecto externo cuando corresponda.

Herramientas posibles:

- external_id;
- event_id;
- unique constraint;
- idempotency key;
- hash;
- tabla de procesamiento/envíos.

---

# 6. Webhooks

Un webhook entrante debe:

1. autenticar/verificar origen;
2. validar formato;
3. comprobar idempotencia;
4. resolver tenant/restaurante;
5. normalizar;
6. persistir o disparar una acción controlada;
7. registrar error de forma segura;
8. responder rápido.

No debe ejecutar lógica pesada síncrona si eso hace frágil el webhook.

Cuando sea necesario:

```
webhook
  ↓
aceptar/validar
  ↓
cola/job
  ↓
procesamiento
```

---

# 7. Polling

Si un proveedor no ofrece webhooks, puede utilizarse polling.

Debe definir:

- frecuencia;
- cursor/última sincronización;
- ventana de seguridad;
- deduplicación;
- reintentos;
- rate limits.

No descargar todo el histórico en cada ejecución si el proveedor permite sincronización incremental.

---

# 8. Reintentos

Los errores transitorios deben poder reintentarse.

Diferenciar:

- 4xx permanente/configuración;
- 401/403 credenciales/permisos;
- 429 rate limit;
- 5xx proveedor;
- timeout/red;
- dato inválido.

No hacer reintentos infinitos sin control.

---

# 9. Observabilidad

Cada integración importante debe poder responder:

- última sincronización correcta;
- última ejecución;
- elementos recibidos;
- elementos rechazados;
- errores;
- latencia;
- proveedor;
- restaurante/scope afectado.

No depender únicamente de “no veo datos en el dashboard” para detectar un fallo.

---

# 10. Estado de integración

A futuro, cada conexión debería tener estados explícitos como:

- connected;
- syncing;
- degraded;
- error;
- disabled.

La interfaz podrá mostrar el estado sin adivinarlo.

---

# 11. Credenciales

Reglas:

- nunca en Git;
- nunca en código;
- nunca enviarlas al navegador si no son públicas;
- mínimo privilegio;
- separar desarrollo/staging/producción;
- rotar si se filtran;
- almacenar mediante secretos/env o sistema seguro.

No imprimir tokens en logs.

---

# 12. Firma/autenticación de webhooks

Preferir, según proveedor:

- firma HMAC;
- secret header;
- token específico;
- validación oficial del proveedor.

No aceptar un webhook público únicamente porque conoce un ID de restaurante.

---

# 13. Permisos

Un proveedor que envía un `restaurant_id` no decide qué usuario puede verlo.

La autorización de usuario sigue siendo responsabilidad de Nexo.

Para acciones salientes:

- verificar permisos;
- verificar scope;
- verificar que el cliente autorizó la conexión.

---

# 14. Raw vs normalizado

Cuando sea útil:

```
payload externo
     ↓
raw/auditable
     ↓
normalización
     ↓
modelo Nexo
```

No es obligatorio conservar todos los payloads para siempre.

Conservarlos cuando ayuden a:

- depuración;
- reprocess;
- auditoría;
- resolver cambios de proveedor.

---

# 15. Versionado de parser

Si una integración compleja cambia su forma de interpretar payloads, puede ser útil registrar versión del parser.

Esto permite saber:

- con qué lógica se procesó un dato;
- si necesita reprocesarse.

---

# 16. Fechas

Distinguir:

- fecha del evento en origen;
- fecha de negocio;
- fecha de recepción;
- fecha de procesamiento.

No reemplazar la fecha real del evento por `now()` simplemente porque llegó tarde.

---

# 17. Unidades

El adaptador debe convertir unidades externas a la convención interna.

Ejemplos:

- tiempos → segundos;
- moneda → importe + currency;
- canales → enum/vocabulario interno;
- timestamps → representación no ambigua.

Las interfaces convierten para mostrar.

---

# 18. Datos borrados o desaparecidos

Si un proveedor deja de devolver algo, no asumir automáticamente que debe borrarse.

Distinguir:

- eliminación confirmada;
- ocultación temporal;
- permiso perdido;
- fallo de sincronización;
- paginación incompleta.

Especialmente importante para reseñas.

---

# 19. Rate limits

Cada integración debe respetar límites del proveedor.

Diseñar:

- backoff;
- batching;
- caché;
- ventanas;
- colas cuando haga falta.

No resolver rate limits metiendo sleeps improvisados por todo el código.

---

# 20. Coste

Para proveedores con coste por uso registrar qué lo impulsa.

Ejemplos:

- llamadas API;
- mensajes WhatsApp;
- scraping;
- tokens IA.

La arquitectura debe permitir medir y limitar coste por:

- cliente;
- restaurante;
- integración;
- periodo,

cuando sea relevante.

---

# 21. Acciones salientes

Leer datos y modificar un sistema externo son riesgos diferentes.

Ejemplos de acciones:

- responder una reseña;
- enviar WhatsApp;
- actualizar una configuración;
- crear algo en un proveedor.

Las acciones deben tener:

- autorización;
- validación;
- registro;
- idempotencia cuando aplique;
- confirmación/flujo de aprobación cuando el riesgo lo requiera.

---

# 22. Make / n8n como transporte

Permitido:

```
Proveedor
  ↓
Make
  ↓
Nexo API
```

o:

```
Nexo
  ↓
Make
  ↓
Proveedor
```

No deseado:

```
Make
  ↓
calcula KPIs
  ↓
decide permisos
  ↓
clasifica estados
  ↓
genera una verdad distinta
```

---

# 23. IA como proveedor

El modelo de IA también es una integración.

Por tanto:

- encapsular proveedor/modelo;
- definir esquema de entrada/salida;
- validar respuesta;
- tener fallback/error;
- persistir resultados cuando sea útil;
- no asumir que texto libre es siempre correcto.

El Domain no debe importar SDKs de IA para calcular una media.

---

# 24. Contrato de integración

Antes de implementar una integración nueva, documentar:

## Fuente

¿Qué sistema es?

## Autenticación

¿Cómo se autoriza?

## Identidad

¿Cómo se mapea a empresa/marca/restaurante?

## Datos

¿Qué campos recibimos?

## Granularidad

¿Evento, minuto, hora, día?

## Frecuencia

¿Webhook, polling, manual?

## Idempotencia

¿Cómo evitamos duplicados?

## Histórico

¿Cuánto podemos recuperar?

## Errores

¿Cómo se reintenta?

## Rate limits

¿Qué límites existen?

## Coste

¿Qué cobra el proveedor?

## Seguridad

¿Qué secretos/permisos necesita?

## Normalización

¿A qué modelo interno se convierte?

## Observabilidad

¿Cómo sabemos si está funcionando?

Sin estas respuestas, la integración todavía no está lista para producción.

---

# 25. Criterio de terminación

Una integración no está “terminada” solo porque aparezca un dato en el dashboard.

Debe cumplir, según relevancia:

- autenticación segura;
- mapping correcto;
- deduplicación;
- histórico inicial;
- sincronización incremental;
- reintentos;
- trazabilidad;
- tests del adaptador;
- alertas de fallo;
- documentación;
- sin lógica de negocio duplicada.

---

# 26. Orden recomendado para futuras integraciones

## Reputación

Estabilizar completamente el pipeline actual.

## StoreAce / ventas

Primera integración operativa nueva.

Objetivo inicial:

- restaurante;
- ventas;
- tickets;
- canales;
- franja/periodo.

## Tiempos

Conectar métricas Auto/servicio.

## Personal

Conectar horas/costes agregados.

## Delivery

Añadir pedidos/ventas/tiempos cuando aporte valor.

Después:

Brain cruza los dominios.

---

# 27. Regla final

Antes de añadir código específico de un proveedor fuera de su adaptador, preguntar:

> ¿seguirá funcionando esta parte de Nexo si mañana cambiamos de proveedor?

Si la respuesta es no, probablemente la separación no está bien hecha.
