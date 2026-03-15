#!/usr/bin/env node
/**
 * Servidor MCP local para BCRA.
 * Expone las APIs del BCRA como tools usables desde Claude Code via stdio.
 * Ejecutar con: npm run mcp
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as bcra from "../lib/bcra-client.js";
import { compact } from "../lib/compact.js";

// ---------------------------------------------------------------------------
// Esquemas de validación
// ---------------------------------------------------------------------------

const VariableSerieSchema = z.object({
  id: z.number().int().positive(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
});

const MetodologiaSchema = z.object({
  id: z.number().int().positive(),
});

const CotizacionFechaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
});

const CotizacionMonedaSchema = z.object({
  codigoMoneda: z.string().min(2).max(5),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
});

const ChequeDenunciadoSchema = z.object({
  codigoEntidad: z.number().int().positive(),
  numeroCheque: z.number().int().positive(),
});

const IdentificacionSchema = z.object({
  identificacion: z.string().regex(/^\d{11}$/, "CUIT de 11 dígitos sin guiones"),
});

const TRANSPARENCIA_PRODUCTOS = [
  "CajasAhorros", "PlazosFijos", "TarjetasCredito", "PaquetesProductos",
  "Prestamos/Prendarios", "Prestamos/Hipotecarios", "Prestamos/Personales",
] as const;

const TransparenciaSchema = z.object({
  codigoEntidad: z.number().int().positive(),
  tipoProducto: z.enum(TRANSPARENCIA_PRODUCTOS),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(compact(data), null, 2) }],
  };
}

function err(message: string): { content: Array<{ type: "text"; text: string }>; isError: boolean } {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "bcra", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// ---------------------------------------------------------------------------
// Lista de tools
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "bcra_variables_listar",
      description: "Lista todas las principales variables monetarias del BCRA con sus últimos valores.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "bcra_variable_serie",
      description: "Obtiene la serie histórica de una variable del BCRA en un rango de fechas.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "number", description: "ID de la variable" },
          desde: { type: "string", description: "Fecha inicio (YYYY-MM-DD)" },
          hasta: { type: "string", description: "Fecha fin (YYYY-MM-DD)" },
        },
        required: ["id", "desde", "hasta"],
      },
    },
    {
      name: "bcra_metodologia_obtener",
      description: "Obtiene la descripción y metodología de una variable del BCRA.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "number", description: "ID de la variable" } },
        required: ["id"],
      },
    },
    {
      name: "bcra_divisas_listar",
      description: "Lista todas las divisas disponibles en el mercado cambiario del BCRA.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "bcra_cotizaciones_fecha",
      description: "Obtiene todas las cotizaciones de divisas para una fecha específica.",
      inputSchema: {
        type: "object",
        properties: { fecha: { type: "string", description: "Fecha (YYYY-MM-DD)" } },
        required: ["fecha"],
      },
    },
    {
      name: "bcra_cotizaciones_moneda",
      description: "Obtiene la evolución histórica de una moneda en un rango de fechas.",
      inputSchema: {
        type: "object",
        properties: {
          codigoMoneda: { type: "string", description: "Código de moneda (ej: USD, EUR)" },
          desde: { type: "string", description: "Fecha inicio (YYYY-MM-DD)" },
          hasta: { type: "string", description: "Fecha fin (YYYY-MM-DD)" },
        },
        required: ["codigoMoneda", "desde", "hasta"],
      },
    },
    {
      name: "bcra_cheques_entidades",
      description: "Lista las entidades bancarias registradas en el sistema de cheques del BCRA.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "bcra_cheque_denunciado",
      description: "Consulta si un cheque fue denunciado en el sistema del BCRA.",
      inputSchema: {
        type: "object",
        properties: {
          codigoEntidad: { type: "number", description: "Código de la entidad bancaria" },
          numeroCheque: { type: "number", description: "Número del cheque" },
        },
        required: ["codigoEntidad", "numeroCheque"],
      },
    },
    {
      name: "bcra_deudor_actual",
      description: "Obtiene la situación crediticia actual de una persona o empresa en la Central de Deudores.",
      inputSchema: {
        type: "object",
        properties: {
          identificacion: { type: "string", description: "CUIT de 11 dígitos sin guiones" },
        },
        required: ["identificacion"],
      },
    },
    {
      name: "bcra_deudor_historico",
      description: "Obtiene el historial crediticio de una persona o empresa en la Central de Deudores.",
      inputSchema: {
        type: "object",
        properties: {
          identificacion: { type: "string", description: "CUIT de 11 dígitos sin guiones" },
        },
        required: ["identificacion"],
      },
    },
    {
      name: "bcra_deudor_cheques_rechazados",
      description: "Consulta cheques rechazados asociados a una persona o empresa.",
      inputSchema: {
        type: "object",
        properties: {
          identificacion: { type: "string", description: "CUIT de 11 dígitos sin guiones" },
        },
        required: ["identificacion"],
      },
    },
    {
      name: "bcra_transparencia_consultar",
      description: "Consulta información de productos financieros de una entidad en el Régimen de Transparencia.",
      inputSchema: {
        type: "object",
        properties: {
          codigoEntidad: { type: "number", description: "Código de la entidad financiera" },
          tipoProducto: {
            type: "string",
            enum: ["CajasAhorros", "PlazosFijos", "TarjetasCredito", "PaquetesProductos", "Prestamos/Prendarios", "Prestamos/Hipotecarios", "Prestamos/Personales"],
            description: "Tipo de producto financiero",
          },
        },
        required: ["codigoEntidad", "tipoProducto"],
      },
    },
  ],
}));

// ---------------------------------------------------------------------------
// Handlers de tools
// ---------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    switch (name) {
      case "bcra_variables_listar": {
        const data = await bcra.listarVariables();
        return ok(data);
      }

      case "bcra_variable_serie": {
        const { id, desde, hasta } = VariableSerieSchema.parse(args);
        const data = await bcra.obtenerSerie(id, desde, hasta);
        return ok(data);
      }

      case "bcra_metodologia_obtener": {
        const { id } = MetodologiaSchema.parse(args);
        const data = await bcra.obtenerMetodologia(id);
        return ok(data);
      }

      case "bcra_divisas_listar": {
        const data = await bcra.listarDivisas();
        return ok(data);
      }

      case "bcra_cotizaciones_fecha": {
        const { fecha } = CotizacionFechaSchema.parse(args);
        const data = await bcra.obtenerCotizacionesFecha(fecha);
        return ok(data);
      }

      case "bcra_cotizaciones_moneda": {
        const { codigoMoneda, desde, hasta } = CotizacionMonedaSchema.parse(args);
        const data = await bcra.obtenerSerieCotizacionMoneda(codigoMoneda, desde, hasta);
        return ok(data);
      }

      case "bcra_cheques_entidades": {
        const data = await bcra.listarEntidadesCheques();
        return ok(data);
      }

      case "bcra_cheque_denunciado": {
        const { codigoEntidad, numeroCheque } = ChequeDenunciadoSchema.parse(args);
        const data = await bcra.consultarChequeDenunciado(codigoEntidad, numeroCheque);
        return ok(data);
      }

      case "bcra_deudor_actual": {
        const { identificacion } = IdentificacionSchema.parse(args);
        const data = await bcra.obtenerDeudorActual(identificacion);
        // Enmascarar ID en el resultado antes de devolver
        const masked = { ...data, identificacion: bcra.maskId(identificacion) };
        return ok(masked);
      }

      case "bcra_deudor_historico": {
        const { identificacion } = IdentificacionSchema.parse(args);
        const data = await bcra.obtenerDeudorHistorico(identificacion);
        const masked = { ...data, identificacion: bcra.maskId(identificacion) };
        return ok(masked);
      }

      case "bcra_deudor_cheques_rechazados": {
        const { identificacion } = IdentificacionSchema.parse(args);
        const data = await bcra.obtenerChequesRechazados(identificacion);
        const masked = { ...data, identificacion: bcra.maskId(identificacion) };
        return ok(masked);
      }

      case "bcra_transparencia_consultar": {
        const { codigoEntidad, tipoProducto } = TransparenciaSchema.parse(args);
        const data = await bcra.consultarTransparencia(codigoEntidad, tipoProducto);
        return ok(data);
      }

      default:
        return err(`Tool desconocida: ${name}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(msg);
  }
});

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // No loggear a stdout — MCP usa stdout para el protocolo
  process.stderr.write("BCRA MCP server iniciado\n");
}

main().catch((e) => {
  process.stderr.write(`Error fatal: ${e}\n`);
  process.exit(1);
});
