
---

# Opción B — Documento de arquitectura profesional

```md
# Documento de arquitectura
## Plataforma conversacional para APIs públicas del BCRA

---

## 1. Resumen ejecutivo

Se propone el desarrollo de una plataforma conversacional basada en IA que permita consultar en lenguaje natural las APIs públicas del Banco Central de la República Argentina (BCRA).

La solución estará orientada a responder preguntas financieras y operativas usando:
- un frontend de chat,
- una capa backend de orquestación,
- un cliente especializado para APIs del BCRA,
- un servidor MCP,
- un modelo Claude para interpretación y redacción.

La arquitectura prioriza:
- control estricto de endpoints y parámetros,
- bajo consumo de contexto y tokens,
- trazabilidad técnica,
- mantenibilidad,
- seguridad en el tratamiento de datos sensibles.

---

## 2. Problema a resolver

Las APIs del BCRA exponen información muy útil, pero su uso directo presenta barreras:

- documentación dispersa o inconsistente,
- respuestas JSON poco amigables para usuarios finales,
- dificultad para traducir preguntas humanas a parámetros técnicos,
- necesidad de manejar errores, paginación y diferencias documentales.

El objetivo es construir una interfaz conversacional que abstraiga esa complejidad.

---

## 3. Objetivos funcionales

La plataforma debe permitir:

1. consultar variables monetarias y series temporales,
2. consultar cotizaciones de divisas,
3. consultar cheques denunciados,
4. consultar situación crediticia y cheques rechazados,
5. consultar productos y condiciones del Régimen de Transparencia,
6. responder en lenguaje natural,
7. pedir sólo los datos faltantes cuando una consulta esté incompleta.

---

## 4. Objetivos no funcionales

La solución debe ser:

- robusta ante inconsistencias documentales,
- económica en uso de tokens,
- segura en tratamiento de datos sensibles,
- observable,
- escalable,
- fácilmente mantenible en Claude Code.

---

## 5. Alcance funcional

### APIs incluidas
- Principales Variables v4.0
- Estadísticas Cambiarias v1.0
- Cheques v1.0
- Central de Deudores v1.0
- Régimen de Transparencia v1.0

### Casos de uso iniciales
- consulta de series,
- cotizaciones por fecha o moneda,
- verificación de cheque denunciado,
- consulta de deudor,
- comparación de productos financieros.

---

## 6. Principios de diseño

### 6.1 Separación de responsabilidades
- el modelo no controla integración,
- el código no redacta lenguaje natural sofisticado.

### 6.2 Código como fuente de verdad
Todos los endpoints y reglas de acceso deben estar centralizados en el cliente BCRA.

### 6.3 Reducción de contexto
Se debe evitar enviar al modelo:
- documentación extensa,
- respuestas completas innecesarias,
- historial irrelevante.

### 6.4 Robustez frente a ambigüedad documental
Se deben parametrizar las diferencias observadas en documentación oficial y ejemplos.

---

## 7. Arquitectura lógica

### 7.1 Vista general

#### Capa 1: Interfaz
Chat web donde el usuario ingresa preguntas en lenguaje natural.

#### Capa 2: Orquestación
Endpoint que:
- recibe el mensaje,
- detecta intención,
- valida si faltan parámetros,
- llama al cliente BCRA,
- compacta la respuesta,
- invoca a Claude para redactar.

#### Capa 3: Integración
Cliente BCRA tipado que encapsula:
- endpoints,
- query params,
- validaciones,
- manejo de errores,
- normalización.

#### Capa 4: Herramientas MCP
Servidor MCP con tools específicas por dominio.

#### Capa 5: Modelo
Claude se utiliza para:
- explicación,
- reformulación,
- respuesta final,
- desambiguación puntual.

---

## 8. Componentes

### 8.1 Frontend
Responsabilidades:
- mostrar historial,
- enviar preguntas,
- renderizar respuestas,
- reflejar estados de carga y error.

### 8.2 Router determinístico
Responsabilidades:
- detectar intención,
- identificar parámetros explícitos,
- minimizar necesidad de usar LLM para parsing.

### 8.3 Cliente BCRA
Responsabilidades:
- controlar acceso a endpoints,
- construir URLs,
- validar inputs,
- manejar errores,
- aislar particularidades documentales.

### 8.4 Compactador
Responsabilidades:
- truncar arrays,
- limitar profundidad,
- eliminar ruido,
- preparar payloads seguros y baratos para el LLM.

### 8.5 Servidor MCP
Responsabilidades:
- exponer tools reutilizables,
- facilitar desarrollo con Claude Code,
- encapsular integraciones del dominio BCRA.

### 8.6 Módulo Claude
Responsabilidades:
- invocar la API de Anthropic,
- enviar contexto mínimo,
- devolver una respuesta clara.

---

## 9. Flujo de procesamiento

1. el usuario escribe una consulta,
2. el frontend la envía al backend,
3. el router clasifica intención,
4. si faltan datos, el sistema los solicita,
5. si la consulta está completa, el cliente BCRA ejecuta la llamada,
6. la respuesta se compacta,
7. Claude genera la respuesta final,
8. el frontend muestra el resultado.

---

## 10. Estrategia MCP

La integración con MCP se diseña para exponer herramientas del dominio BCRA, por ejemplo:

- variables monetarias,
- series históricas,
- divisas,
- cheques,
- deudores,
- transparencia.

Esto permite:
- desarrollar desde Claude Code con acceso semántico a herramientas reales,
- desacoplar integración de interfaz,
- favorecer mantenibilidad.

---

## 11. Estrategia de ahorro de tokens

### Medidas principales

#### A. Router antes que LLM
Resolver por código:
- regex,
- parseo de fechas,
- detección de moneda,
- identificación de CUIT/CUIL,
- número de cheque,
- código de entidad.

#### B. Compactación agresiva
No enviar JSON completos del BCRA.

#### C. Contexto mínimo
Mandar sólo:
- última consulta,
- intención,
- datos compactados,
- contexto seguro.

#### D. Instrucciones persistentes
Usar `CLAUDE.md` para evitar repetir indicaciones.

#### E. No usar el historial completo salvo necesidad
El historial debe mantenerse corto y controlado.

---

## 12. Seguridad y cumplimiento

### Riesgos
- exposición de identificaciones sensibles,
- persistencia innecesaria de resultados de deudores,
- logs inseguros,
- respuestas sobredimensionadas.

### Medidas
- masking de identificaciones,
- mínimos logs,
- no persistencia por defecto,
- validación estricta de inputs,
- control de errores del lado servidor.

---

## 13. Estructura técnica sugerida

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