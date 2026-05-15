/**
 * Clasificador determinístico de intenciones.
 * Analiza el texto libre del usuario y extrae intención + parámetros
 * sin invocar al LLM, siguiendo las reglas de CLAUDE.md.
 */

// ---------------------------------------------------------------------------
// Tipos de intención
// ---------------------------------------------------------------------------

export type Intent =
  | { type: "variables_listar" }
  | { type: "variables_filtrar"; filtros: import("./bcra-client").VariablesFiltros }
  | { type: "variable_serie"; id: number; desde: string; hasta: string }
  | { type: "metodologias_listar" }
  | { type: "metodologia"; id: number }
  | { type: "divisas_listar" }
  | { type: "cotizacion_fecha"; fecha: string; moneda?: string }
  | { type: "cotizacion_moneda"; moneda: string; desde: string; hasta: string }
  | { type: "cheques_entidades" }
  | { type: "cheque_denunciado"; entidad: number; numero: number }
  | { type: "deudor_actual"; identificacion: string }
  | { type: "deudor_historico"; identificacion: string }
  | { type: "deudor_cheques_rechazados"; identificacion: string }
  | { type: "transparencia"; entidad: number; producto: import("./bcra-client").TransparenciaProducto }
  | { type: "sociedad_buscar"; nombre: string }
  | { type: "sociedad_por_cuit"; cuit: string }
  | { type: "desconocido" };

export interface RouterResult {
  intent: Intent;
  /** Parámetros faltantes para completar la intención */
  missing: string[];
}

// ---------------------------------------------------------------------------
// Patrones de extracción
// ---------------------------------------------------------------------------

const DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/g;
const CUIT_DASHED_RE = /\b(\d{2}-\d{7,8}-\d{1})\b/;
const CUIT_PLAIN_RE = /\b(\d{11})\b/;
const CURRENCY_RE =
  /\b(USD|EUR|BRL|UYU|PYG|GBP|CHF|JPY|CAD|AUD|CLF|MXN|CNY|HKD|COP|BOB|PEN|VES|ARS)\b/i;

function todayISO(): string {
  // BCRA usa hora argentina (UTC-3) — evita enviar fecha futura desde servidores en UTC
  const now = new Date();
  const arg = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return arg.toISOString().slice(0, 10);
}

function extractDates(text: string): string[] {
  const explicit = Array.from(text.matchAll(DATE_RE), (m) => m[1]);
  if (explicit.length) return explicit;
  // Fechas relativas
  const t = text.toLowerCase();
  if (/\bhoy\b/.test(t)) return [todayISO()];
  if (/\bayer\b/.test(t)) {
    const now = new Date();
    const arg = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    arg.setDate(arg.getDate() - 1);
    return [arg.toISOString().slice(0, 10)];
  }
  return [];
}

function extractNumbers(text: string): number[] {
  // Evitar capturar CUITs y fechas como números genéricos
  const clean = text
    .replace(CUIT_DASHED_RE, "")
    .replace(CUIT_PLAIN_RE, "")
    .replace(DATE_RE, "");
  return Array.from(clean.matchAll(/\b(\d+)\b/g), (m) => parseInt(m[1], 10));
}

function extractCuit(text: string): string | null {
  const dashed = CUIT_DASHED_RE.exec(text);
  if (dashed) return dashed[1].replace(/-/g, "");
  const plain = CUIT_PLAIN_RE.exec(text);
  if (plain) return plain[1];
  return null;
}

function extractCurrency(text: string): string | null {
  const m = CURRENCY_RE.exec(text);
  return m ? m[1].toUpperCase() : null;
}

function normalizeProducto(text: string): import("./bcra-client").TransparenciaProducto {
  const lower = text.toLowerCase();
  if (/plazos?\s*fijos?/.test(lower)) return "PlazosFijos";
  if (/tarjeta.*?cr[eé]dito/.test(lower)) return "TarjetasCredito";
  if (/prendario/.test(lower)) return "Prestamos/Prendarios";
  if (/hipotecario/.test(lower)) return "Prestamos/Hipotecarios";
  if (/personal|consumo/.test(lower)) return "Prestamos/Personales";
  if (/paquete|combo/.test(lower)) return "PaquetesProductos";
  if (/caja.?ahorro/.test(lower)) return "CajasAhorros";
  return "PlazosFijos"; // fallback razonable
}

// ---------------------------------------------------------------------------
// Clasificador principal
// ---------------------------------------------------------------------------

export function classify(text: string): RouterResult {
  const t = text.toLowerCase();
  const dates = extractDates(text);
  const nums = extractNumbers(text);
  const cuit = extractCuit(text);
  const moneda = extractCurrency(text);

  // --- Registro Nacional de Sociedades ---

  if (/sociedad|empresa|razón\s*social|razon\s*social|inscripci[oó]n|registro\s*(nacional|de)\s*soc/.test(t) && cuit) {
    return { intent: { type: "sociedad_por_cuit", cuit }, missing: [] };
  }

  if (/buscar?\s*(sociedad|empresa)|sociedad|empresa|razón\s*social|razon\s*social|inscripci[oó]n/.test(t)) {
    // Extraer nombre: todo lo que siga a "buscar", "empresa", "sociedad", etc.
    const match = text.match(/(?:buscar?|sociedad|empresa|llamada|denominada?)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ\s\d.,-]+)/i);
    const nombre = match ? match[1].trim() : text.trim();
    if (nombre.length < 2) return { intent: { type: "sociedad_buscar", nombre: "" }, missing: ["nombre de la sociedad"] };
    return { intent: { type: "sociedad_buscar", nombre }, missing: [] };
  }

  // --- Central de Deudores ---

  if (
    /cheques?\s+rechazados?/.test(t) &&
    (cuit || /cuit|cuil|cdi/.test(t))
  ) {
    if (!cuit) return { intent: { type: "deudor_cheques_rechazados", identificacion: "" }, missing: ["identificacion (CUIT)"] };
    return { intent: { type: "deudor_cheques_rechazados", identificacion: cuit }, missing: [] };
  }

  if (
    /hist[oó]rico|historial|pasad[ao]/.test(t) &&
    /deuda|creditici[ao]|situaci[oó]n/.test(t)
  ) {
    if (!cuit) return { intent: { type: "deudor_historico", identificacion: "" }, missing: ["identificacion (CUIT)"] };
    return { intent: { type: "deudor_historico", identificacion: cuit }, missing: [] };
  }

  if (
    /deuda|creditici[ao]|situaci[oó]n/.test(t) &&
    (cuit || /cuit|cuil|cdi/.test(t))
  ) {
    if (!cuit) return { intent: { type: "deudor_actual", identificacion: "" }, missing: ["identificacion (CUIT)"] };
    return { intent: { type: "deudor_actual", identificacion: cuit }, missing: [] };
  }

  // --- Cheques ---

  if (/denunci[ao]d[ao]|cheque/.test(t) && nums.length >= 2) {
    // Asumir que el número más pequeño es la entidad y el mayor el cheque
    const sorted = [...nums].sort((a, b) => a - b);
    return {
      intent: { type: "cheque_denunciado", entidad: sorted[0], numero: sorted[sorted.length - 1] },
      missing: [],
    };
  }

  if (/entidades.*(cheque|banco)|bancos.*(cheque)|cheques?.*(entidad|banco|entidades)/.test(t)) {
    return { intent: { type: "cheques_entidades" }, missing: [] };
  }

  // --- Régimen de Transparencia ---

  if (
    /transparencia|plazos?\s*fijos?|tarjeta|pr[eé]stamos?|dep[oó]sitos?|caja\s*de?\s*ahorro|cuenta\s*corriente/.test(t) &&
    /entidad|banco|\d+/.test(t)
  ) {
    const entidadNum = nums[0];
    if (!entidadNum) {
      return { intent: { type: "transparencia", entidad: 0, producto: "PlazosFijos" }, missing: ["entidad (código)"] };
    }
    const producto = normalizeProducto(t);
    return { intent: { type: "transparencia", entidad: entidadNum, producto }, missing: [] };
  }

  // --- Cotizaciones cambiarias ---

  if (/evoluci[oó]n|historial|serie/.test(t) && moneda && dates.length >= 2) {
    return {
      intent: { type: "cotizacion_moneda", moneda, desde: dates[0], hasta: dates[1] },
      missing: [],
    };
  }

  if (/evoluci[oó]n|historial|serie/.test(t) && moneda) {
    return {
      intent: { type: "cotizacion_moneda", moneda, desde: "", hasta: "" },
      missing: ["fechaDesde", "fechaHasta"],
    };
  }

  if (/cotizaci[oó]n|tipo.de.cambio|precio|valor|d[oó]lar|euro|dolar/.test(t) && dates.length >= 1) {
    return {
      intent: { type: "cotizacion_fecha", fecha: dates[0], moneda: moneda ?? undefined },
      missing: [],
    };
  }

  // Sin fecha explícita pero con mención de moneda/cambio → última jornada disponible (sin fecha)
  if (/cotizaci[oó]n|tipo.de.cambio|valor|precio|d[oó]lar|euro|dolar/.test(t)) {
    return {
      intent: { type: "cotizacion_fecha", fecha: "", moneda: moneda ?? undefined },
      missing: [],
    };
  }

  if (/divisas?|monedas?|currencies/.test(t)) {
    return { intent: { type: "divisas_listar" }, missing: [] };
  }

  // --- Variables monetarias ---

  if (/metodolog[ií]as?\s*(todas?|listado|listar|disponibles?|completa)/.test(t) ||
      (/metodolog[ií]as?/.test(t) && !/variable\s*\d|id\s*\d|\d/.test(t))) {
    return { intent: { type: "metodologias_listar" }, missing: [] };
  }

  if (/metodolog[ií]a|descripci[oó]n/.test(t) && nums.length >= 1) {
    return { intent: { type: "metodologia", id: nums[0] }, missing: [] };
  }

  if (/serie|datos|evoluci[oó]n/.test(t) && /variable/.test(t) && nums.length >= 1 && dates.length >= 2) {
    return {
      intent: { type: "variable_serie", id: nums[0], desde: dates[0], hasta: dates[1] },
      missing: [],
    };
  }

  if (/serie|datos/.test(t) && nums.length >= 1 && dates.length >= 2) {
    return {
      intent: { type: "variable_serie", id: nums[0], desde: dates[0], hasta: dates[1] },
      missing: [],
    };
  }

  if (/variable/.test(t) && nums.length >= 1 && dates.length >= 2) {
    return {
      intent: { type: "variable_serie", id: nums[0], desde: dates[0], hasta: dates[1] },
      missing: [],
    };
  }

  if (/variables?\s+(de\s+)?(tasas?|inter[eé]s|tipo|reservas?|precios?|dep[oó]sitos?|pr[eé]stamos?)|filtrar\s+variables?|variables?\s+filtradas?|variables?\s+por\s+(categor[ií]a|periodicidad|moneda|tipo)/.test(t)) {
    const filtros: import("./bcra-client").VariablesFiltros = {};
    if (/\bdiaria?\b/.test(t)) filtros.periodicidad = "D";
    if (/\bmensual\b/.test(t)) filtros.periodicidad = "M";
    if (/\bmoneda\s+extranjera\b|\bme\b/.test(t)) filtros.moneda = "ME";
    if (/\bmoneda\s+local\b|\bml\b|\bpesos?\b/.test(t)) filtros.moneda = "ML";
    if (/tasas?\s+de\s+inter[eé]s|inter[eé]s/.test(t)) filtros.tipoSerie = "Tasa de interés";
    if (/reservas?/.test(t)) filtros.tipoSerie = "Saldos";
    return { intent: { type: "variables_filtrar", filtros }, missing: [] };
  }

  if (/variables?|monetari[ao]|estad[ií]stica/.test(t)) {
    return { intent: { type: "variables_listar" }, missing: [] };
  }

  return { intent: { type: "desconocido" }, missing: [] };
}
