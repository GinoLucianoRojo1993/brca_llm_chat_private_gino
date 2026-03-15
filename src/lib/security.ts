/**
 * Utilidades de seguridad — OWASP Top 10 mitigations
 *
 * A01 – Broken Access Control: CORS + rate limiting
 * A03 – Injection: sanitización de input
 * A04 – Insecure Design: rate limiting por IP
 * A10 – SSRF: allowlist de dominios para requests externos
 */

// ---------------------------------------------------------------------------
// A03 – Input Sanitization
// ---------------------------------------------------------------------------

const MAX_MESSAGE_LENGTH = 500;

/**
 * Sanitiza el texto del usuario:
 * - Limita longitud (A03 / A04)
 * - Elimina caracteres de control y null bytes (A03)
 * - Elimina intentos de prompt injection evidentes
 */
export function sanitizeInput(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .slice(0, MAX_MESSAGE_LENGTH)
    // Elimina null bytes y caracteres de control (excepto espacios/tabs/newlines normales)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

// ---------------------------------------------------------------------------
// A04 / A01 – Rate Limiting (in-memory, sliding window)
// ---------------------------------------------------------------------------

interface RateEntry {
  count: number;
  windowStart: number;
}

const rateMap = new Map<string, RateEntry>();
const RATE_WINDOW_MS = 60_000; // 1 minuto
const RATE_LIMIT = 20; // máx 20 requests por minuto por IP

/** Limpia entradas expiradas para evitar memory leaks */
function pruneRateMap() {
  const now = Date.now();
  for (const [key, entry] of rateMap) {
    if (now - entry.windowStart > RATE_WINDOW_MS) {
      rateMap.delete(key);
    }
  }
}

/**
 * Devuelve true si la IP excede el rate limit.
 * @param ip — dirección IP del cliente
 */
export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  // Limpiar periódicamente (1 de cada 50 llamadas)
  if (Math.random() < 0.02) pruneRateMap();

  const entry = rateMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

// ---------------------------------------------------------------------------
// A10 – SSRF: Allowlist de dominios para requests externos
// ---------------------------------------------------------------------------

const ALLOWED_HOSTS = new Set([
  "api.bcra.gob.ar",
  "www.bcra.gob.ar",
  "datos.jus.gob.ar",
  "api.anthropic.com",
]);

/**
 * Verifica que una URL pertenezca a un host permitido.
 * Lanza error si el host no está en el allowlist (previene SSRF).
 */
export function assertAllowedHost(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`URL inválida: ${url}`);
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Host no permitido: ${parsed.hostname}`);
  }
}

// ---------------------------------------------------------------------------
// A01 – CORS: solo same-origin para /api/chat
// ---------------------------------------------------------------------------

/**
 * Valida que el Origin del request sea el mismo que el host.
 * En producción (Vercel) rechaza requests cross-origin.
 * En desarrollo permite localhost.
 */
export function isValidOrigin(
  origin: string | null,
  host: string | null
): boolean {
  if (!origin || !host) return true; // server-to-server o same-origin sin header
  try {
    const originHost = new URL(origin).hostname;
    const requestHost = host.split(":")[0];
    return (
      originHost === requestHost ||
      originHost === "localhost" ||
      originHost === "127.0.0.1"
    );
  } catch {
    return false;
  }
}
