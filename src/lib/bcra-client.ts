import https from "https";

/**
 * Cliente HTTP tipado para las APIs públicas del BCRA.
 * Toda URL canónica del proyecto vive aquí — no dispersar paths en otros archivos.
 *
 * Paths verificados contra OpenAPI oficial (www.bcra.gob.ar/archivos/Catalogo/Content/files/json/):
 *   - principales-variables-v4.json
 *   - estadisticascambiarias-v1.json
 *   - cheques-v1.json
 *   - central-deudores-v1.json
 *   - regimen-transparencia-v1.json
 */

const BASE_URL = process.env.BCRA_API_BASE_URL ?? "https://api.bcra.gob.ar";

// ---------------------------------------------------------------------------
// Tipos de respuesta
// ---------------------------------------------------------------------------

export interface BcraEnvelope<T> {
  status: number;
  errorMessages?: string[];
  metadata?: { resultset?: { count: number; offset: number; limit: number } };
  results: T;
}

// --- Principales Variables v4.0 ---

export interface Variable {
  idVariable: number;
  descripcion: string;
  categoria: string;
  tipoSerie: string;
  periodicidad: string;
  unidadExpresion: string;
  moneda: string;
  primerFechaInformada: string;
  ultFechaInformada: string;
  ultValorInformado: number | null;
}

export interface DetalleSerie {
  fecha: string;
  valor: number;
}

export interface SerieDatos {
  idVariable: number;
  detalle: DetalleSerie[];
}

export interface Metodologia {
  idVariable: number;
  descripcion: string;
  metodologia: string;
  fuente?: string;
  unidad?: string;
}

// --- Estadísticas Cambiarias v1.0 ---

export interface Divisa {
  codigo: string;
  denominacion: string;
}

export interface DetalleCotizacion {
  codigoMoneda: string;
  descripcion: string;
  tipoPase: number;
  tipoCotizacion: number;
}

export interface CotizacionesFecha {
  fecha: string;
  detalle: DetalleCotizacion[];
}

export interface CotizacionMonedaDia {
  fecha: string;
  detalle: DetalleCotizacion[];
}

// --- Cheques v1.0 ---

export interface EntidadCheques {
  codigoEntidad: number;
  denominacion: string;
}

export interface DetalleChequeDenunciado {
  sucursal: number;
  numeroCuenta: string;
  causal: string;
}

export interface ChequeDenunciado {
  numeroCheque: number;
  denunciado: boolean;
  fechaProcesamiento: string;
  denominacionEntidad: string;
  detalles: DetalleChequeDenunciado[];
}

// --- Central de Deudores v1.0 ---

export interface EntidadDeuda {
  entidad: number;
  situacion: number;
  monto: number;
  diasAtrasoPago: number;
  refinanciaciones: boolean;
  recategorizacionOblig: boolean;
  situacionJuridica: boolean;
  irrecuperables: boolean;
}

export interface PeriodoDeuda {
  periodo: string;
  entidades: EntidadDeuda[];
}

export interface Deudor {
  identificacion: string;
  denominacion: string;
  periodos: PeriodoDeuda[];
}

export interface ChequeRechazado {
  nroCheque: number;
  fechaRechazo: string;
  monto: number;
  fechaPago: string | null;
  estado: string;
  codigoEntidad: number;
  denominacionEntidad: string;
}

export interface DeudorChequesRechazados {
  identificacion: string;
  denominacion: string;
  chequesRechazados: ChequeRechazado[];
}

// --- Transparencia v1.0 ---

export type TransparenciaItem = Record<string, unknown>;

/**
 * Productos disponibles en el Régimen de Transparencia.
 * Mapeados a sus paths exactos de la API.
 */
export type TransparenciaProducto =
  | "CajasAhorros"
  | "PlazosFijos"
  | "TarjetasCredito"
  | "PaquetesProductos"
  | "Prestamos/Prendarios"
  | "Prestamos/Hipotecarios"
  | "Prestamos/Personales";

// ---------------------------------------------------------------------------
// Privacidad
// ---------------------------------------------------------------------------

/** Enmascara una identificación (CUIT/CUIL/CDI) para logs y mensajes. */
export function maskId(id: string): string {
  const clean = id.replace(/-/g, "");
  if (clean.length <= 3) return "***";
  return clean.slice(0, 2) + "*".repeat(clean.length - 3) + clean.slice(-1);
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function buildUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

/**
 * GET helper usando el módulo `https` nativo (HTTP/1.1).
 * Evita el ECONNRESET que produce undici (fetch) con algunos servidores del BCRA.
 */
async function get<T>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const urlStr = buildUrl(path, params);
  const parsed = new URL(urlStr);

  const body = await new Promise<string>((resolve, reject) => {
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: { Accept: "application/json" },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(new Error("BCRA request timeout")); });
    req.end();
  });

  const envelope = JSON.parse(body) as BcraEnvelope<T>;

  // Algunos endpoints devuelven HTTP 4xx con JSON de error en el body
  if (envelope.errorMessages?.length) {
    throw new Error(`BCRA error: ${envelope.errorMessages.join(", ")} — ${urlStr}`);
  }
  return envelope.results;
}

// ---------------------------------------------------------------------------
// Principales Variables v4.0
// Path base: /estadisticas/v4.0
// ---------------------------------------------------------------------------

const VARS = "/estadisticas/v4.0";

export function listarVariables(limit = 1000, offset = 0): Promise<Variable[]> {
  return get<Variable[]>(`${VARS}/Monetarias`, {
    Limit: String(limit),
    Offset: String(offset),
  });
}

export function obtenerSerie(
  id: number,
  desde: string,
  hasta: string,
  limit = 1000
): Promise<SerieDatos[]> {
  return get<SerieDatos[]>(`${VARS}/Monetarias/${id}`, {
    Desde: desde,
    Hasta: hasta,
    Limit: String(limit),
  });
}

export function obtenerMetodologia(id: number): Promise<Metodologia> {
  return get<Metodologia>(`${VARS}/Metodologia/${id}`);
}

// ---------------------------------------------------------------------------
// Estadísticas Cambiarias v1.0
// Path base: /estadisticascambiarias/v1.0
// ---------------------------------------------------------------------------

const FX = "/estadisticascambiarias/v1.0";

export function listarDivisas(): Promise<Divisa[]> {
  return get<Divisa[]>(`${FX}/Maestros/Divisas`);
}

/**
 * Cotizaciones de todas las monedas.
 * Sin fecha → devuelve la última jornada disponible.
 * Con fecha → devuelve la jornada de esa fecha (YYYY-MM-DD).
 */
export function obtenerCotizacionesFecha(
  fecha?: string
): Promise<CotizacionesFecha> {
  return get<CotizacionesFecha>(`${FX}/Cotizaciones`, fecha ? { fecha } : undefined);
}

/** Serie de cotizaciones de una moneda específica entre dos fechas. */
export function obtenerSerieCotizacionMoneda(
  codMoneda: string,
  fechaDesde: string,
  fechaHasta: string,
  limit = 1000
): Promise<CotizacionMonedaDia[]> {
  return get<CotizacionMonedaDia[]>(`${FX}/Cotizaciones/${codMoneda}`, {
    fechaDesde,
    fechaHasta,
    limit: String(limit),
  });
}

// ---------------------------------------------------------------------------
// Cheques v1.0
// Path base: /cheques/v1.0
// ---------------------------------------------------------------------------

const CHQ = "/cheques/v1.0";

export function listarEntidadesCheques(): Promise<EntidadCheques[]> {
  return get<EntidadCheques[]>(`${CHQ}/entidades`);
}

export function consultarChequeDenunciado(
  codigoEntidad: number,
  numeroCheque: number
): Promise<ChequeDenunciado> {
  return get<ChequeDenunciado>(
    `${CHQ}/denunciados/${codigoEntidad}/${numeroCheque}`
  );
}

// ---------------------------------------------------------------------------
// Central de Deudores v1.0
// Path base: /centraldedeudores/v1.0  (prefijo fijo, confirmado por OpenAPI)
// ---------------------------------------------------------------------------

const CD = "/centraldedeudores/v1.0";

export function obtenerDeudorActual(identificacion: string): Promise<Deudor> {
  return get<Deudor>(`${CD}/Deudas/${identificacion}`);
}

export function obtenerDeudorHistorico(identificacion: string): Promise<Deudor> {
  return get<Deudor>(`${CD}/Deudas/Historicas/${identificacion}`);
}

export function obtenerChequesRechazados(
  identificacion: string
): Promise<DeudorChequesRechazados> {
  return get<DeudorChequesRechazados>(
    `${CD}/Deudas/ChequesRechazados/${identificacion}`
  );
}

// ---------------------------------------------------------------------------
// Régimen de Transparencia v1.0
// Path base: /transparencia/v1.0
// Los productos usan query param ?codigoEntidad={id}
// ---------------------------------------------------------------------------

const TR = "/transparencia/v1.0";

export function consultarTransparencia(
  codigoEntidad: number,
  producto: TransparenciaProducto
): Promise<TransparenciaItem[]> {
  return get<TransparenciaItem[]>(`${TR}/${producto}`, {
    codigoEntidad: String(codigoEntidad),
  });
}
