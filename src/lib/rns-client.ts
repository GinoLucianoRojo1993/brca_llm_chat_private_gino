/**
 * Cliente para el Registro Nacional de Sociedades (datos.jus.gob.ar)
 * Usa la API CKAN Datastore — no requiere archivos locales, funciona en Vercel.
 *
 * Recurso: Muestreo del Registro Nacional de Sociedades
 * https://datos.jus.gob.ar/dataset/ee83de85-4305-4c53-9a9f-fd3d15e42c36
 */

const CKAN_BASE = "https://datos.jus.gob.ar/api/3/action";

// Resource IDs
const RNS_MUESTREO_ID = "6096331b-0511-4728-b01b-6c6b535f4c2b";

const CAMPOS = [
  "cuit",
  "razon_social",
  "tipo_societario",
  "fecha_hora_contrato_social",
  "fecha_hora_actualizacion",
  "numero_inscripcion",
  "dom_fiscal_provincia",
  "dom_fiscal_localidad",
  "dom_fiscal_calle",
  "dom_fiscal_numero",
  "dom_fiscal_cp",
  "dom_fiscal_estado_domicilio",
].join(",");

export interface Sociedad {
  cuit: string;
  razon_social: string;
  tipo_societario: string;
  fecha_hora_contrato_social?: string;
  fecha_hora_actualizacion?: string;
  numero_inscripcion?: string;
  dom_fiscal_provincia?: string;
  dom_fiscal_localidad?: string;
  dom_fiscal_calle?: string;
  dom_fiscal_numero?: string;
  dom_fiscal_cp?: string;
  dom_fiscal_estado_domicilio?: string;
}

interface CkanResult {
  success: boolean;
  result?: {
    total: number;
    records: Sociedad[];
  };
  error?: { message: string };
}

async function ckanGet(params: Record<string, string>): Promise<CkanResult> {
  const qs = new URLSearchParams(params).toString();
  const url = `${CKAN_BASE}/datastore_search?${qs}`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`CKAN error ${res.status}`);
  return res.json() as Promise<CkanResult>;
}

/**
 * Busca sociedades por nombre (búsqueda de texto libre).
 * Máximo 10 resultados.
 */
export async function buscarSociedadPorNombre(
  nombre: string,
  limit = 10
): Promise<{ total: number; records: Sociedad[] }> {
  const data = await ckanGet({
    resource_id: RNS_MUESTREO_ID,
    q: nombre,
    fields: CAMPOS,
    limit: String(limit),
  });
  if (!data.success || !data.result) {
    throw new Error("Error al consultar el Registro Nacional de Sociedades");
  }
  return data.result;
}

/**
 * Busca una sociedad exacta por CUIT (11 dígitos sin guiones).
 */
export async function buscarSociedadPorCuit(
  cuit: string
): Promise<Sociedad | null> {
  const data = await ckanGet({
    resource_id: RNS_MUESTREO_ID,
    filters: JSON.stringify({ cuit }),
    fields: CAMPOS,
    limit: "1",
  });
  if (!data.success || !data.result) {
    throw new Error("Error al consultar el Registro Nacional de Sociedades");
  }
  return data.result.records[0] ?? null;
}

/**
 * Lista sociedades filtradas por tipo (SA, SRL, etc.) y/o provincia.
 */
export async function listarSociedades(opts: {
  tipo?: string;
  provincia?: string;
  limit?: number;
}): Promise<{ total: number; records: Sociedad[] }> {
  const filters: Record<string, string> = {};
  if (opts.tipo) filters["tipo_societario"] = opts.tipo.toUpperCase();
  if (opts.provincia) filters["dom_fiscal_provincia"] = opts.provincia.toUpperCase();

  const params: Record<string, string> = {
    resource_id: RNS_MUESTREO_ID,
    fields: CAMPOS,
    limit: String(opts.limit ?? 10),
  };
  if (Object.keys(filters).length > 0) {
    params["filters"] = JSON.stringify(filters);
  }

  const data = await ckanGet(params);
  if (!data.success || !data.result) {
    throw new Error("Error al consultar el Registro Nacional de Sociedades");
  }
  return data.result;
}
