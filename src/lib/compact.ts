/**
 * Compactador de payloads.
 * Reduce el tamaño de respuestas BCRA antes de enviarlas a Claude,
 * limitando arrays y profundidad para evitar tokens innecesarios.
 */

export interface CompactOptions {
  /** Máximo de items por array (default: 20) */
  maxArrayItems?: number;
  /** Máxima profundidad de objetos anidados (default: 5) */
  maxDepth?: number;
}

export function compact(
  value: unknown,
  opts: CompactOptions = {},
  depth = 0
): unknown {
  const maxItems = opts.maxArrayItems ?? 20;
  const maxDepth = opts.maxDepth ?? 5;

  if (depth >= maxDepth) return "[truncado]";
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    const sliced = value.slice(0, maxItems);
    const result = sliced.map((item) => compact(item, opts, depth + 1));
    if (value.length > maxItems) {
      return [...result, `... (${value.length - maxItems} items más)`];
    }
    return result;
  }

  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = compact(v, opts, depth + 1);
  }
  return result;
}

/** Convierte el resultado compactado a string JSON legible para el prompt. */
export function compactJson(value: unknown, opts?: CompactOptions): string {
  const compacted = compact(value, opts);
  return JSON.stringify(compacted ?? null, null, 2);
}
