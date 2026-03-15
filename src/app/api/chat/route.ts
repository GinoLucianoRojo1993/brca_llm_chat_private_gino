import { NextRequest, NextResponse } from "next/server";
import { classify } from "@/lib/router";
import { compactJson } from "@/lib/compact";
import { callClaude } from "@/lib/claude";
import { maskId } from "@/lib/bcra-client";
import * as bcra from "@/lib/bcra-client";
import * as rns from "@/lib/rns-client";
import { sanitizeInput, isRateLimited, isValidOrigin } from "@/lib/security";

export const runtime = "nodejs";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

// ---------------------------------------------------------------------------
// Helpers de prompt
// ---------------------------------------------------------------------------

function buildPrompt(question: string, intentLabel: string, data: unknown): string {
  return `Pregunta del usuario: ${question}

Intención detectada: ${intentLabel}

Datos obtenidos:
\`\`\`json
${compactJson(data, { maxArrayItems: 30, maxDepth: 8 })}
\`\`\`

Respondé la pregunta del usuario usando los datos anteriores. Sé claro y conciso.`;
}

// ---------------------------------------------------------------------------
// Orquestador principal
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // A01 – CORS: validar origin
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!isValidOrigin(origin, host)) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }

  // A04 – Rate limiting por IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Esperá un momento e intentá de nuevo." },
      { status: 429 }
    );
  }

  // A09 – Limitar tamaño del body
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > 10_000) {
    return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  }

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const messages = body.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return NextResponse.json({ error: "Sin mensaje de usuario" }, { status: 400 });
  }

  // A03 – Sanitizar input del usuario
  const question = sanitizeInput(lastUser.content);
  if (!question) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  const { intent, missing } = classify(question);

  // Si faltan parámetros, responder sin llamar al LLM
  if (missing.length > 0) {
    const reply = `Para responder esa consulta necesito que me indiques: ${missing.join(", ")}.`;
    return NextResponse.json({ reply });
  }

  try {
    let prompt: string;

    switch (intent.type) {
      case "variables_listar": {
        const data = await bcra.listarVariables();
        prompt = buildPrompt(question, "listar variables monetarias", data);
        break;
      }

      case "variable_serie": {
        const data = await bcra.obtenerSerie(intent.id, intent.desde, intent.hasta);
        const detalle = data[0]?.detalle ?? data;
        prompt = buildPrompt(
          question,
          `serie de variable ${intent.id} (${intent.desde} — ${intent.hasta})`,
          detalle
        );
        break;
      }

      case "metodologia": {
        const data = await bcra.obtenerMetodologia(intent.id);
        prompt = buildPrompt(question, `metodología variable ${intent.id}`, data);
        break;
      }

      case "divisas_listar": {
        const data = await bcra.listarDivisas();
        prompt = buildPrompt(question, "listar divisas", data);
        break;
      }

      case "cotizacion_fecha": {
        let data = await bcra.obtenerCotizacionesFecha(intent.fecha || undefined).catch(() => null);
        // Fallback si: sin datos, fin de semana, feriado, o fecha inválida (timezone)
        if (!data?.fecha || !data?.detalle?.length) {
          data = await bcra.obtenerCotizacionesFecha(undefined);
        }
        let payload: unknown = data;
        if (intent.moneda && data?.detalle) {
          const filtered = data.detalle.filter(
            (c) => c.codigoMoneda.toUpperCase() === intent.moneda!.toUpperCase()
          );
          payload = { fecha: data.fecha, detalle: filtered };
        }
        const fechaLabel = data?.fecha ?? "última jornada disponible";
        prompt = buildPrompt(
          question,
          `cotizaciones del ${fechaLabel}${intent.moneda ? ` — ${intent.moneda}` : ""}`,
          payload
        );
        break;
      }

      case "cotizacion_moneda": {
        const data = await bcra.obtenerSerieCotizacionMoneda(
          intent.moneda,
          intent.desde,
          intent.hasta
        );
        prompt = buildPrompt(
          question,
          `evolución ${intent.moneda} (${intent.desde} — ${intent.hasta})`,
          data
        );
        break;
      }

      case "cheques_entidades": {
        const data = await bcra.listarEntidadesCheques();
        prompt = buildPrompt(question, "entidades del sistema de cheques", data);
        break;
      }

      case "cheque_denunciado": {
        const data = await bcra.consultarChequeDenunciado(intent.entidad, intent.numero);
        prompt = buildPrompt(
          question,
          `cheque ${intent.numero} entidad ${intent.entidad}`,
          data
        );
        break;
      }

      case "deudor_actual": {
        const data = await bcra.obtenerDeudorActual(intent.identificacion);
        const masked = { ...data, identificacion: maskId(intent.identificacion) };
        prompt = buildPrompt(question, "situación crediticia actual", masked);
        break;
      }

      case "deudor_historico": {
        const data = await bcra.obtenerDeudorHistorico(intent.identificacion);
        const masked = { ...data, identificacion: maskId(intent.identificacion) };
        prompt = buildPrompt(question, "historial crediticio", masked);
        break;
      }

      case "deudor_cheques_rechazados": {
        const data = await bcra.obtenerChequesRechazados(intent.identificacion);
        const masked = { ...data, identificacion: maskId(intent.identificacion) };
        prompt = buildPrompt(question, "cheques rechazados", masked);
        break;
      }

      case "transparencia": {
        const data = await bcra.consultarTransparencia(intent.entidad, intent.producto);
        prompt = buildPrompt(
          question,
          `transparencia entidad ${intent.entidad} — ${intent.producto}`,
          data
        );
        break;
      }

      case "sociedad_buscar": {
        const data = await rns.buscarSociedadPorNombre(intent.nombre);
        prompt = buildPrompt(
          question,
          `búsqueda de sociedad "${intent.nombre}" en el Registro Nacional de Sociedades`,
          data
        );
        break;
      }

      case "sociedad_por_cuit": {
        const data = await rns.buscarSociedadPorCuit(intent.cuit);
        prompt = buildPrompt(
          question,
          `sociedad por CUIT ${maskId(intent.cuit)} en el Registro Nacional de Sociedades`,
          data ?? { mensaje: "No se encontró ninguna sociedad con ese CUIT en el registro." }
        );
        break;
      }

      case "desconocido":
      default: {
        prompt = `El usuario pregunta sobre el BCRA o el sistema financiero argentino: ${question}\n\nResponde con lo que sepas o indica qué información concreta necesitás para ayudarlo mejor.`;
        break;
      }
    }

    const reply = await callClaude(prompt);
    return NextResponse.json({ reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    if (/no se encontr[oó]/i.test(msg) || /ECONNRESET|ECONNREFUSED|timeout/i.test(msg)) {
      const reply = await callClaude(
        `El usuario preguntó: "${question}"\n\nEl servicio no devolvió datos para esa consulta (puede que no existan registros o el servicio no esté disponible). Informale de forma clara y amable, sin inventar información.`
      );
      return NextResponse.json({ reply });
    }
    console.error("[chat/route]", msg);
    return NextResponse.json(
      { reply: `Ocurrió un error al procesar la consulta: ${msg}` },
      { status: 200 }
    );
  }
}
