# Asistente conversacional BCRA con IA, MCP y Claude Code

## Descripción

Este proyecto implementa una aplicación conversacional que permite consultar en lenguaje natural las APIs públicas del BCRA.  
El usuario puede escribir preguntas como:

- “Mostrame la evolución del USD entre 2024-06-01 y 2024-06-30”
- “Consultá si el cheque 20377516 del banco 11 fue denunciado”
- “Traé la situación crediticia actual del CUIT 20123456789”
- “Compará plazos fijos del banco 11”

La aplicación interpreta la intención del usuario, consulta las APIs oficiales del BCRA y devuelve una respuesta clara y conversacional usando IA.

---

## Objetivo

Construir una app robusta, barata en consumo de tokens y fácil de mantener, donde:

- el conocimiento técnico de las APIs viva en código,
- la conversación viva en el modelo,
- la integración externa esté expuesta vía MCP,
- Claude Code se use como entorno principal de desarrollo.

---

## APIs del BCRA contempladas

### 1. Principales Variables v4.0
Permite:
- listar variables monetarias,
- consultar series temporales,
- consultar metodologías.

Casos de uso:
- evolución de reservas,
- valor histórico de una variable,
- explicación metodológica.

### 2. Estadísticas Cambiarias v1.0
Permite:
- listar divisas,
- consultar cotizaciones por fecha,
- consultar evolución histórica por moneda.

Casos de uso:
- cotización del USD en una fecha,
- evolución del EUR,
- catálogo de monedas soportadas.

### 3. Cheques denunciados v1.0
Permite:
- listar entidades bancarias,
- consultar si un cheque fue denunciado.

Casos de uso:
- validación operativa de cheques,
- consulta por número de cheque y código de entidad.

### 4. Central de Deudores v1.0
Permite:
- consultar deuda actual,
- consultar histórico,
- consultar cheques rechazados.

Casos de uso:
- situación crediticia,
- historial de deuda,
- rechazo de cheques por CUIT/CUIL/CDI.

### 5. Régimen de Transparencia v1.0
Permite:
- consultar productos bancarios,
- comparar tasas y condiciones,
- recuperar datos de:
  - cajas de ahorro,
  - paquetes,
  - plazos fijos,
  - préstamos personales,
  - préstamos hipotecarios,
  - préstamos prendarios,
  - tarjetas de crédito.

---

## Principio de diseño

### Regla principal
**Las URLs, parámetros y validaciones del BCRA deben vivir en código.**  
**El modelo no debe inventar endpoints ni decidir paths.**

Esto reduce:
- errores,
- dependencia del contexto,
- consumo de tokens,
- fragilidad ante documentación ambigua.

---

## Arquitectura

### Componentes

#### Frontend
Interfaz de chat simple para que el usuario escriba consultas.

#### API de chat
Recibe la pregunta, clasifica intención, ejecuta la consulta y genera la respuesta final.

#### Router determinístico
Detecta:
- API objetivo,
- tipo de consulta,
- fechas,
- moneda,
- CUIT/CUIL,
- número de cheque,
- entidad,
- tipo de producto financiero.

#### Cliente BCRA
Contiene:
- todos los endpoints,
- manejo de errores,
- fetch tipado,
- configuración por variables de entorno.

#### Compactador
Reduce el tamaño del JSON antes de enviarlo al modelo.

#### Servidor MCP
Expone tools especializadas para trabajar con BCRA desde Claude Code.

#### Modelo Claude
Se usa solo para:
- desambiguación compleja,
- redacción final,
- explicación clara al usuario.

---

## Estructura del proyecto

```text
bcra-chat/
  .mcp.json
  CLAUDE.md
  .env.local
  docs/
    bcra-summary.md
  src/
    app/
      api/
        chat/
          route.ts
      page.tsx
    lib/
      bcra-client.ts
      router.ts
      compact.ts
      claude.ts
    mcp/
      bcra-server.ts