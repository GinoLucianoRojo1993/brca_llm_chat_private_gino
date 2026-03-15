# CLAUDE.md — bcra-chat

## Objetivo
App web conversacional que permite consultar APIs públicas del BCRA en lenguaje natural usando Claude como motor de respuestas.

## Arquitectura general
```
usuario → UI (page.tsx) → POST /api/chat → router.ts → bcra-client.ts → compact.ts → claude.ts → respuesta
```
El modelo solo interviene al final, después de que el código determinístico resolvió intención y datos.

## Restricciones obligatorias

### Endpoints BCRA
- No inventar endpoints. Toda URL canónica vive en `src/lib/bcra-client.ts`.
- El modelo nunca decide paths ni parámetros de integración.
- Base URL configurable: `BCRA_API_BASE_URL` (default: https://api.bcra.gob.ar)
- Prefijo Central de Deudores configurable: `BCRA_CENTRAL_DEUDORES_PREFIX` (default: centraldedeudores)

### Contexto y tokens
- Usar router antes que LLM — resolver intención con código determinístico.
- Mandar solo la última pregunta al modelo, no el historial completo.
- Compactar payloads BCRA antes de enviar a Claude (ver compact.ts).
- No copiar documentación completa del BCRA en prompts ni en código.
- No pegar OpenAPI completos en prompts o en el código.

### Privacidad
- Nunca guardar CUIT/CUIL/CDI completos en logs.
- Enmascarar identificaciones sensibles en respuestas y mensajes de error.
- Función `maskId()` disponible en bcra-client.ts.

## APIs contempladas
1. Principales Variables v4.0 → `/estadisticas/v4.0/...`
2. Estadísticas Cambiarias v1.0 → `/estadisticascambiarias/v1.0/...`
3. Cheques v1.0 → `/cheques/v1.0/...`
4. Central de Deudores v1.0 → `/{CD_PREFIX}/v1.0/...`
5. Régimen de Transparencia v1.0 → `/regimen-transparencia/v1.0/...`

## Variables de entorno
```
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
BCRA_API_BASE_URL=https://api.bcra.gob.ar
BCRA_CENTRAL_DEUDORES_PREFIX=centraldedeudores
```

## Convenciones técnicas
- TypeScript estricto en todo el proyecto.
- Validación de inputs con zod (MCP server) o guards inline (route handler).
- Manejo explícito de errores HTTP y errores funcionales del BCRA.
- Código simple y claro — claridad sobre sofisticación excesiva.
- Sin dependencias innecesarias.

## Estructura de archivos
```
src/
  app/
    api/chat/route.ts   — orquestador principal
    layout.tsx          — layout Next.js
    page.tsx            — UI de chat
  lib/
    bcra-client.ts      — cliente HTTP tipado para BCRA
    router.ts           — clasificador determinístico de intención
    compact.ts          — compactador de payloads
    claude.ts           — wrapper para la API de Anthropic
  mcp/
    bcra-server.ts      — servidor MCP stdio
```

## Orden de trabajo para nuevas features
1. Agregar endpoint en bcra-client.ts (con tipo de respuesta)
2. Agregar intención en router.ts
3. Agregar case en route.ts
4. Agregar tool en bcra-server.ts
5. Correr typecheck

## Próximos pasos sugeridos
- Agregar caché de respuestas BCRA (TTL corto, evita llamadas repetidas)
- Paginación para series largas
- Soporte streaming en /api/chat
- Tests unitarios para router.ts
