# bcra-chat

Aplicación web conversacional para consultar las APIs públicas del BCRA en lenguaje natural, usando Claude como motor de respuestas.

**Demo en producción:** https://bcraapiapp.vercel.app

---

## Qué hace

El usuario escribe preguntas en lenguaje natural; la app detecta la intención, llama a las APIs oficiales del BCRA y devuelve una respuesta clara generada por IA.

Ejemplos de consultas:
- "¿Cuánto están las reservas internacionales hoy?"
- "Mostrame la evolución del USD entre 2024-06-01 y 2024-06-30"
- "Consultá si el cheque 20377516 del banco 11 fue denunciado"
- "Traé la situación crediticia actual del CUIT 20123456789"
- "Compará plazos fijos del banco 11"
- "Listame las metodologías de las variables del BCRA"
- "Filtrá variables de tasa de interés en moneda local"

---

## Arquitectura

```
usuario → UI (page.tsx) → POST /api/chat → router.ts → bcra-client.ts → compact.ts → claude.ts → respuesta
```

El modelo solo interviene al final, después de que el código determinístico resolvió intención y datos.

```
src/
  app/
    api/chat/route.ts   — orquestador principal (rate limit → sanitize → router → API → compact → Claude)
    layout.tsx          — layout Next.js
    page.tsx            — UI de chat
  lib/
    bcra-client.ts      — cliente HTTP tipado para BCRA (TODAS las URLs canónicas aquí)
    router.ts           — clasificador determinístico de intenciones (15 tipos)
    compact.ts          — compactador de payloads BCRA antes de enviar al LLM
    claude.ts           — wrapper Anthropic API
    rns-client.ts       — cliente CKAN para Registro Nacional de Sociedades
    security.ts         — OWASP: sanitizeInput, isRateLimited, assertAllowedHost, isValidOrigin
  mcp/
    bcra-server.ts      — servidor MCP stdio con 14 tools
```

---

## APIs integradas

| API | Versión | Funcionalidades |
|-----|---------|-----------------|
| Estadísticas Monetarias | **v4.0** | Variables, series históricas, metodologías |
| Estadísticas Cambiarias | v1.0 | Divisas, cotizaciones por fecha, series de moneda |
| Cheques Denunciados | v1.0 | Entidades, consulta de cheques denunciados |
| Central de Deudores | v1.0 | Deuda actual, historial, cheques rechazados |
| Régimen de Transparencia | v1.0 | 7 productos financieros por entidad |
| Registro Nacional de Sociedades | CKAN | Búsqueda por nombre o CUIT |

---

## Setup

### Requisitos
- Node.js 18+
- Cuenta en [Anthropic](https://console.anthropic.com/) con API key

### Instalación

```bash
git clone https://github.com/GinoLucianoRojo1993/brca_llm_chat_private_gino.git
cd bcra_api_app
npm install
```

### Variables de entorno

Crear `.env.local`:

```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
BCRA_API_BASE_URL=https://api.bcra.gob.ar
BCRA_CENTRAL_DEUDORES_PREFIX=centraldedeudores
```

### Desarrollo

```bash
npm run dev        # Next.js en localhost:3000
npm run mcp        # MCP server stdio (para Claude Code)
npm run typecheck  # Verificar tipos TypeScript
```

---

## Seguridad (OWASP Top 10) ✅

Análisis completo contra OWASP Top 10 2021 — todas las categorías mitigadas:

| # | Vulnerabilidad | Mitigación |
|---|----------------|------------|
| A01 | Broken Access Control | CORS `isValidOrigin()` → 403; rate limit per-IP; router determinístico |
| A02 | Cryptographic Failures | HSTS 2 años + preload; API key solo server-side; sin datos sensibles en reposo |
| A03 | Injection | `sanitizeInput()` strip null bytes / control chars; React auto-escaping; sin SQL; URL params tipados |
| A04 | Insecure Design | Rate limit 20 req/min; body limit 10KB; URLs BCRA hardcodeadas (no user-controlled) |
| A05 | Security Misconfiguration | CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options, Permissions-Policy |
| A06 | Vulnerable Components | `npm audit` 0 vulnerabilities — dependencias actualizadas |
| A07 | Auth Failures | N/A — app pública; API key server-side, nunca expuesta al cliente |
| A08 | Data Integrity | `package-lock.json` (integridad de deps); sin deserialización de datos no confiables |
| A09 | Logging & Monitoring | `maskId()` enmascara CUIT/CUIL; logging de violaciones CORS y rate limit |
| A10 | SSRF | `assertAllowedHost()` allowlist; BASE_URL fijo por env (no user-controlled) |

---

## MCP Server

El servidor MCP expone las APIs del BCRA como tools para usar desde Claude Code:

```bash
npm run mcp
```

Configurado en `.mcp.json`. Tools disponibles (14):

| Tool | Descripción |
|------|-------------|
| `bcra_variables_listar` | Lista todas las variables monetarias |
| `bcra_variables_filtrar` | **NUEVO** — Filtra por categoría, periodicidad, moneda, tipo |
| `bcra_variable_serie` | Serie histórica de una variable |
| `bcra_metodologias_listar` | **NUEVO** — Lista todas las metodologías con descripciones |
| `bcra_metodologia_obtener` | Metodología de una variable específica |
| `bcra_divisas_listar` | Lista divisas disponibles |
| `bcra_cotizaciones_fecha` | Cotizaciones de una fecha |
| `bcra_cotizaciones_moneda` | Evolución de una moneda en rango de fechas |
| `bcra_cheques_entidades` | Entidades del sistema de cheques |
| `bcra_cheque_denunciado` | Consulta si un cheque fue denunciado |
| `bcra_deudor_actual` | Situación crediticia actual (CUIT) |
| `bcra_deudor_historico` | Historial crediticio (CUIT) |
| `bcra_deudor_cheques_rechazados` | Cheques rechazados (CUIT) |
| `bcra_transparencia_consultar` | Productos financieros por entidad |

---

## Novedades — Release actual

### Nuevas funcionalidades integradas

- **Listado de metodologías (`bcra_metodologias_listar`)**
  Nuevo endpoint `GET /estadisticas/v4.0/Metodologia` expuesto en el servidor MCP y en el chat. Devuelve las descripciones metodológicas de las 1.200+ variables estadísticas con paginación. Preguntar "listame todas las metodologías del BCRA" ahora funciona.

- **Filtrado de variables monetarias (`bcra_variables_filtrar`)**
  El endpoint `GET /estadisticas/v4.0/Monetarias` ahora acepta filtros: `Categoria`, `Periodicidad` (D/M), `Moneda` (ML/ME/MEyML), `TipoSerie`, `UnidadExpresion`. Expuesto tanto en MCP como en el chat. Ejemplos: "variables de tasa de interés en pesos", "variables diarias".

### Correcciones de tipos (Central de Deudores OpenAPI v1.0)

- **`EntidadDeuda`** — Campos corregidos/añadidos según la especificación oficial:
  - `entidad` ahora es `string | null` (antes `number`)
  - Campo `fechaSit1: string | null` añadido
  - `irrecDisposicionTecnica` reemplaza al antiguo `irrecuperables`
  - Campos nuevos: `enRevision: boolean`, `procesoJud: boolean`

- **`DeudorHistorico`** — Nuevo tipo separado para el endpoint histórico:
  - Campos `HistorialEntidad` (subconjunto de `EntidadDeuda`): `entidad`, `situacion`, `monto`, `enRevision`, `procesoJud`

- **`DeudorChequesRechazados`** — Estructura completamente rework según OpenAPI:
  - Antes: `chequesRechazados: ChequeRechazado[]` (plano)
  - Ahora: `causales: ChequeCausal[]` → `entidades: ChequeEntidadRechazada[]` → `detalle: ChequeRechazadoDetalle[]`
  - Campos nuevos en detalle: `fechaPagoMulta`, `estadoMulta`, `ctaPersonal`, `denomJuridica`, `enRevision`, `procesoJud`

### Compatibilidad de versiones

| API | Versión activa | Anteriores |
|-----|---------------|------------|
| Estadísticas Monetarias | **v4.0** | v3.0 depreca 28/02/2026, v2.0 deprecó 01/06/2025, v1.0 deprecó 15/06/2024 |
| Estadísticas Cambiarias | v1.0 | — |
| Cheques | v1.0 | — |
| Central de Deudores | v1.0 | — |
| Régimen de Transparencia | v1.0 | — |

---

## Deploy en Vercel

```bash
vercel --prod
```

Configuración en `vercel.json`: región `gru1` (São Paulo), `maxDuration: 30s` para `/api/chat`.

Variables de entorno a setear en Vercel:
```bash
# Usar echo -n para evitar newline al final (bug conocido con vercel CLI)
echo -n "sk-ant-..." | vercel env add ANTHROPIC_API_KEY production
echo -n "claude-sonnet-4-6" | vercel env add ANTHROPIC_MODEL production
echo -n "https://api.bcra.gob.ar" | vercel env add BCRA_API_BASE_URL production
echo -n "centraldedeudores" | vercel env add BCRA_CENTRAL_DEUDORES_PREFIX production
```

---

## Easter eggs

- **Konami code** (↑↑↓↓←→←→BA) → muestra créditos del dev en el chat
- Escribir **"quien hizo esto"** → créditos
- **5 clicks** en el logo 🏦 → toggle dark mode

---

## Desarrollado por

**Gino Luciano Rojo** — [linkedin.com/in/gino-luciano-rojo/](https://linkedin.com/in/gino-luciano-rojo/)

Contacto BCRA para APIs: api@bcra.gob.ar
