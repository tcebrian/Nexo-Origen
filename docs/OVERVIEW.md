# Nexo Origen — Overview

## Qué es Nexo

Nexo Origen es una plataforma de inteligencia operativa para restauración.

Hoy su vertical más madura es la reputación online. El objetivo a largo plazo es conectar reputación con datos operativos para que un responsable pueda entender no solo **qué está pasando**, sino también **por qué puede estar pasando** y dónde conviene actuar.

## North Star

Una persona responsable de un restaurante, una marca o una red debería poder preguntar:

> ¿Cómo va mi restaurante y qué debería revisar?

Y Nexo debería responder utilizando evidencia trazable de reputación, ventas, tiempos, personal y otros datos disponibles, diferenciando claramente entre:

- hechos;
- cálculos;
- patrones;
- hipótesis;
- recomendaciones.

## Qué problema resuelve

Los restaurantes suelen tener la información repartida entre distintas herramientas:

- reseñas;
- TPV / ventas;
- delivery;
- tiempos de servicio;
- horarios;
- personal;
- costes;
- informes manuales.

Nexo debe unificar esas fuentes y transformar datos dispersos en información operativa útil.

## Producto actual

El repositorio ya contiene una aplicación funcional en Next.js con:

- autenticación y roles;
- alcance por empresa / marca / restaurante;
- dashboards;
- consumo de reseñas desde Supabase;
- KPIs de reputación y comparativas por periodo;
- clasificación de reseñas y análisis IA;
- alertas y notificaciones;
- generación de informes;
- generación de imágenes de alertas;
- ranking, insights y otras vistas;
- SQL y soporte de esquema para Supabase.

El producto actual debe seguir funcionando mientras mejoramos la arquitectura.

## Hacia dónde evoluciona

### Reputación

Reseñas, medias, motivos, tendencias, alertas, SEO local y flujos de respuesta.

### Ventas

Ventas, tickets, ticket medio, mix de canales, ventas por hora/franja y comparativas.

### Tiempos de servicio

Auto / drive-thru, mostrador, cocina, delivery y otros tiempos operativos.

### Personal

Horas, dotación, coste laboral, labor %, productividad y cobertura por franja.

### Costes

Food cost y otros costes operativos cuando exista una fuente fiable.

## Capa de inteligencia

Nexo no debe convertirse en varios dashboards independientes.

Debe conectar los dominios.

Ejemplo:

Ventas ↑  
Tickets ↑  
Personal =  
Tiempo de servicio ↑  
Quejas por espera ↑

Nexo debería poder detectar esa relación como una hipótesis operativa y mostrar la evidencia que la sostiene.

## Arquitectura principal

**Fuentes → Ingesta → Database → Domain → Brain → API → Interfaces**

- **Database** almacena la realidad operativa normalizada.
- **Domain** aplica reglas y cálculos deterministas.
- **Brain** detecta patrones, anomalías, correlaciones y genera explicaciones.
- **API** expone las capacidades de Nexo.
- **Web, WhatsApp, email e informes** son interfaces.

Un mismo cálculo debe definirse una sola vez y reutilizarse en todas las interfaces.

## Principio de migración

No reconstruir Nexo desde cero.

El repositorio actual ya tiene modularidad parcial. Primero reforzaremos límites dentro del código existente. Solo extraeremos servicios separados cuando exista una necesidad operativa real.

## Principio de producto

Nexo no pretende sustituir inicialmente:

- TPVs;
- herramientas de horarios;
- software de fichaje;
- plataformas delivery;
- otros sistemas operativos especializados.

Nexo debe conectarlos, normalizar sus datos y convertir la información fragmentada en inteligencia operativa.

## Cómo sabemos que vamos por el camino correcto

Cada nueva funcionalidad debe responder con claridad:

1. ¿De dónde viene el dato?
2. ¿Dónde se guarda?
3. ¿Qué cálculo o regla se aplica?
4. ¿Necesita interpretación?
5. ¿Cómo se expone?
6. ¿Qué usuarios pueden verlo?
7. ¿Cómo se prueba?
8. ¿Qué interfaz lo consume?

Si una nueva función obliga a duplicar reglas en Web, informes o WhatsApp, la arquitectura no está bien resuelta.

## Qué no queremos

- lógica distinta según la interfaz;
- cálculos ocultos dentro de componentes visuales;
- automatizaciones externas actuando como cerebro principal;
- depender de una IA concreta;
- depender del ordenador personal de Tomás;
- cambios directos en producción;
- microservicios antes de necesitarlos.
