# bcra-chat — Documentación

App web conversacional que permite consultar las APIs públicas del Banco Central de la República Argentina (BCRA) usando lenguaje natural. El sistema clasifica la intención del usuario con código determinístico, consulta la API del BCRA, compacta el resultado y genera una respuesta en lenguaje claro mediante Claude.

---

## Índice

1. [Arquitectura](#arquitectura)
2. [APIs del BCRA cubiertas](#apis-del-bcra-cubiertas)
3. [Features](#features)
4. [Pruebas realizadas](#pruebas-realizadas)
5. [Guía de uso](#guía-de-uso)
6. [Variables de entorno](#variables-de-entorno)
7. [Estructura de archivos](#estructura-de-archivos)
8. [Decisiones técnicas](#decisiones-técnicas)
9. [Limitaciones conocidas](#limitaciones-conocidas)
10. [Próximos pasos](#próximos-pasos)

---

## Arquitectura

```
Usuario
  │
  ▼
UI de chat (page.tsx)
  │  POST /api/chat  { messages }
  ▼
Route handler (route.ts)
  │
  ├─► Router determinístico (router.ts)
  │     Detecta: intención, fechas, moneda, CUIT, entidad, cheque, producto
  │
  ├─► BCRA Client (bcra-client.ts)
  │     HTTP/1.1 via módulo https nativo
  │     Endpoints verificados contra OpenAPI oficial del BCRA
  │
  ├─► Compactador (compact.ts)
  │     Limita arrays y profundidad antes de enviar al modelo
  │
  └─► Claude (claude.ts)
        POST /v1/messages con prompt estructurado
        Respuesta en texto → JSON al frontend
```

**Principio central:** el modelo solo se invoca al final, con datos ya resueltos. No decide paths, parámetros ni intenciones.

---

## APIs del BCRA cubiertas

Todos los endpoints fueron verificados contra los OpenAPI oficiales publicados en:
`https://www.bcra.gob.ar/archivos/Catalogo/Content/files/json/`

| API | Versión | Base path |
|-----|---------|-----------|
| Principales Variables (Monetarias) | v4.0 | `/estadisticas/v4.0` |
| Estadísticas Cambiarias | v1.0 | `/estadisticascambiarias/v1.0` |
| Cheques | v1.0 | `/cheques/v1.0` |
| Central de Deudores | v1.0 | `/centraldedeudores/v1.0` |
| Régimen de Transparencia | v1.0 | `/transparencia/v1.0` |

### Endpoints implementados

#### Principales Variables v4.0
| Endpoint | Descripción |
|----------|-------------|
| `GET /estadisticas/v4.0/Monetarias` | Lista todas las variables con último valor |
| `GET /estadisticas/v4.0/Monetarias/{id}?Desde=&Hasta=` | Serie histórica de una variable |
| `GET /estadisticas/v4.0/Metodologia/{id}` | Metodología y fuente de una variable |

#### Estadísticas Cambiarias v1.0
| Endpoint | Descripción |
|----------|-------------|
| `GET /estadisticascambiarias/v1.0/Maestros/Divisas` | Lista de divisas disponibles |
| `GET /estadisticascambiarias/v1.0/Cotizaciones?fecha=` | Cotizaciones para una fecha (sin fecha = última jornada hábil) |
| `GET /estadisticascambiarias/v1.0/Cotizaciones/{cod}?fechaDesde=&fechaHasta=` | Serie de una moneda en rango |

#### Cheques v1.0
| Endpoint | Descripción |
|----------|-------------|
| `GET /cheques/v1.0/entidades` | Lista de entidades bancarias |
| `GET /cheques/v1.0/denunciados/{entidad}/{numero}` | Consulta si un cheque fue denunciado |

#### Central de Deudores v1.0
| Endpoint | Descripción |
|----------|-------------|
| `GET /centraldedeudores/v1.0/Deudas/{id}` | Situación crediticia actual |
| `GET /centraldedeudores/v1.0/Deudas/Historicas/{id}` | Historial crediticio (24 meses) |
| `GET /centraldedeudores/v1.0/Deudas/ChequesRechazados/{id}` | Cheques rechazados por CUIT |

#### Régimen de Transparencia v1.0
Todos usan query param `?codigoEntidad={id}`

| Endpoint | Descripción |
|----------|-------------|
| `GET /transparencia/v1.0/PlazosFijos` | Plazos fijos de una entidad |
| `GET /transparencia/v1.0/TarjetasCredito` | Tarjetas de crédito |
| `GET /transparencia/v1.0/CajasAhorros` | Cajas de ahorro |
| `GET /transparencia/v1.0/PaquetesProductos` | Paquetes de productos |
| `GET /transparencia/v1.0/Prestamos/Prendarios` | Préstamos prendarios |
| `GET /transparencia/v1.0/Prestamos/Hipotecarios` | Préstamos hipotecarios |
| `GET /transparencia/v1.0/Prestamos/Personales` | Préstamos personales |

---

## Features

### Clasificación determinística de intenciones
El router analiza el texto del usuario con expresiones regulares antes de llamar al modelo. Extrae:
- **Fechas** en formato `YYYY-MM-DD` o relativas ("hoy", "ayer")
- **Monedas** por código ISO: USD, EUR, BRL, etc.
- **CUIT/CUIL** en formato `XX-XXXXXXXX-X` o 11 dígitos planos
- **Códigos numéricos** de entidad y número de cheque
- **Tipo de producto financiero** para Transparencia

### Fallback a última jornada hábil
Cuando el usuario consulta cotizaciones "hoy" o sin fecha y el BCRA no tiene datos (fin de semana / feriado), el sistema automáticamente usa la última jornada disponible.

### Compactación de payloads
Los resultados del BCRA se compactan antes de enviarse al modelo:
- Máximo 30 items por array
- Máxima profundidad de 8 niveles
- Evita mandar respuestas masivas (variables: 1177 items)

### Privacidad de identificaciones
Los CUIT/CUIL/CDI se enmascaran antes de ser enviados al modelo y antes de ser logueados:
```
20375500001  →  20*******01
```

### Manejo de "sin datos" del BCRA
Cuando el BCRA responde que no hay datos para una consulta (404 con mensaje), el sistema lo presenta como respuesta informativa en lugar de error técnico.

### Servidor MCP local
El proyecto incluye un servidor MCP vía `stdio` con 12 tools que exponen todas las APIs del BCRA directamente desde Claude Code.

```json
// .mcp.json
{
  "mcpServers": {
    "bcra": {
      "command": "npm",
      "args": ["run", "mcp"],
      "type": "stdio"
    }
  }
}
```

---

## Pruebas realizadas

Todas las consultas de ejemplo del brief original fueron probadas contra la API real del BCRA.

| # | Consulta | Intención detectada | Resultado |
|---|---------|---------------------|-----------|
| 1 | "Listame las variables monetarias del BCRA" | `variables_listar` | ✅ Lista 1177 variables compactadas a 30, organizadas por categoría |
| 2 | "Mostrame la serie de la variable 1 entre 2025-01-01 y 2025-01-31" | `variable_serie` | ✅ 22 días hábiles de Reservas Internacionales con tabla y análisis |
| 3 | "Dame la metodología de la variable 1" | `metodologia` | ✅ Fuente, periodicidad y nota de cierre de año |
| 4 | "Qué cotización tenía el EUR el 2024-06-12" | `cotizacion_fecha` | ✅ Cotización del EUR para esa fecha |
| 5 | "Mostrame la evolución del USD entre 2024-06-01 y 2024-06-30" | `cotizacion_moneda` | ✅ 17 días hábiles, variación +1.67%, análisis de crawling peg |
| 6 | "Consultá si el cheque 20377516 del banco 11 fue denunciado" | `cheque_denunciado` | ✅ Cheque denunciado con sucursal, cuenta y motivo |
| 7 | "Traé la situación crediticia actual del CUIT 20375500001" | `deudor_actual` | ✅ 3 entidades, situaciones 4 y 5, montos, CUIT enmascarado |
| 8 | "Mostrame cheques rechazados del CUIT 20375500001" | `deudor_cheques_rechazados` | ✅ Sin registros (respuesta informativa amable) |
| 9 | "Compará plazos fijos del banco 11" | `transparencia` / `PlazosFijos` | ✅ Tabla comparativa con tasas, canales y montos mínimos |
| 10 | "Qué tarjetas de crédito informa la entidad 11" | `transparencia` / `TarjetasCredito` | ✅ VISA Internacional con ingresos mínimos, comisiones y TEA |

**Prueba adicional:**
- "Dime el valor del dólar hoy" (sábado, sin datos) → fallback automático a última jornada hábil (viernes) ✅

---

## Guía de uso

### Requisitos
- Node.js 18+
- npm
- API key de Anthropic

### Instalación
```bash
git clone <repo>
cd bcra-chat
npm install
```

### Configuración
Completar `.env.local`:
```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
BCRA_API_BASE_URL=https://api.bcra.gob.ar
BCRA_CENTRAL_DEUDORES_PREFIX=centraldedeudores
```

### Ejecutar en desarrollo
```bash
npm run dev
# → http://localhost:3000
```

### Build para producción
```bash
npm run build
npm start
```

### Typecheck
```bash
npm run typecheck
```

### Servidor MCP (para usar desde Claude Code)
```bash
npm run mcp
```
O automáticamente si `.mcp.json` está configurado en Claude Code.

### Consultas de ejemplo

#### Variables monetarias
```
Listame las variables monetarias del BCRA
Mostrame la serie de la variable 4 entre 2025-01-01 y 2025-03-01
Dame la metodología de la variable 4
```

#### Tipo de cambio
```
Dime el valor del dólar hoy
Qué cotización tenía el EUR el 2024-06-12
Mostrame la evolución del USD entre 2024-01-01 y 2024-03-31
Listame las divisas disponibles
```

#### Cheques
```
Consultá si el cheque 20377516 del banco 11 fue denunciado
Listame las entidades del sistema de cheques
```

#### Central de Deudores
```
Traé la situación crediticia actual del CUIT 20123456789
Mostrame el historial crediticio del CUIT 20-12345678-9
Mostrame cheques rechazados del CUIT 20123456789
```

#### Régimen de Transparencia
```
Compará plazos fijos del banco 11
Qué tarjetas de crédito informa la entidad 11
Mostrá las cajas de ahorro del banco 7
Qué préstamos personales tiene la entidad 72
```

---

## Variables de entorno

| Variable | Requerida | Descripción | Default |
|----------|-----------|-------------|---------|
| `ANTHROPIC_API_KEY` | ✅ | API key de Anthropic | — |
| `ANTHROPIC_MODEL` | No | Modelo de Claude a usar | `claude-sonnet-4-6` |
| `BCRA_API_BASE_URL` | No | Base URL de la API del BCRA | `https://api.bcra.gob.ar` |
| `BCRA_CENTRAL_DEUDORES_PREFIX` | No | Prefijo del servicio de deudores | `centraldedeudores` |

---

## Estructura de archivos

```
bcra-chat/
├── .env.local                    # Variables de entorno (no commitear)
├── .mcp.json                     # Configuración del servidor MCP
├── CLAUDE.md                     # Reglas persistentes del proyecto para Claude
├── next.config.ts
├── package.json
├── tsconfig.json
├── docs/
│   └── README.md                 # Este documento
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx              # UI de chat
    │   └── api/
    │       └── chat/
    │           └── route.ts      # Orquestador principal
    ├── lib/
    │   ├── bcra-client.ts        # Cliente HTTP tipado — todas las URLs canónicas
    │   ├── router.ts             # Clasificador determinístico de intenciones
    │   ├── compact.ts            # Compactador de payloads
    │   └── claude.ts             # Wrapper API de Anthropic
    └── mcp/
        └── bcra-server.ts        # Servidor MCP con 12 tools
```

---

## Decisiones técnicas

### HTTP/1.1 para Central de Deudores
El módulo `https` nativo de Node.js (HTTP/1.1) se usa en lugar de `fetch` (HTTP/2 vía undici). Algunos endpoints de la API del BCRA cierran conexiones HTTP/2 con `ECONNRESET`. El módulo `https` resuelve el problema de forma transparente.

### Router antes que LLM
Clasificar la intención con código determinístico evita llamadas innecesarias al modelo y garantiza que los paths y parámetros de las APIs del BCRA nunca los decida el LLM.

### Compactación de respuestas
La API de Variables devuelve hasta 1177 items. Sin compactación, un solo request podría consumir decenas de miles de tokens. El compactador limita a 30 items y 8 niveles de profundidad por defecto.

### Enmascaramiento de CUIT
El CUIT se enmascara antes de enviarse al modelo y antes de loguearse, nunca se persiste completo.

### Endpoints verificados contra OpenAPI oficial
Todos los paths se verificaron contra los specs OpenAPI publicados por el BCRA en:
- `principales-variables-v4.json`
- `estadisticascambiarias-v1.json`
- `cheques-v1.json`
- `central-deudores-v1.json`
- `regimen-transparencia-v1.json`

---

## Limitaciones conocidas

| Limitación | Descripción |
|------------|-------------|
| Sin historial de conversación | Cada consulta es independiente. El modelo no recuerda intercambios anteriores. |
| Sin paginación en UI | Para variables con muchos datos, se limita a los primeros 1000 registros de la API. |
| ChequesRechazados inconsistente | Algunos CUITs sin datos provocan `ECONNRESET` en el servidor del BCRA (no es un error del cliente). |
| Transparencia sin "depositos" | El Régimen de Transparencia v1.0 no expone un endpoint genérico de depósitos; los productos disponibles son los 7 especificados. |
| Cotizaciones en feriados | La API del BCRA no publica datos en días no hábiles; el sistema hace fallback automático a la última jornada disponible. |

---

## Próximos pasos

- **Caché de respuestas**: TTL corto (5-15 min) para variables y cotizaciones, evita llamadas repetidas al BCRA.
- **Streaming**: Usar respuestas en streaming para mejorar la UX en consultas lentas.
- **Historial de conversación**: Pasar los últimos N intercambios al modelo para consultas de seguimiento.
- **Tests unitarios**: Cubrir `router.ts` con los casos del brief y casos borde.
- **Paginación**: Para series largas, solicitar más páginas si el count supera el limit.
- **Rate limiting**: Limitar requests por IP para proteger la API key de Anthropic.
