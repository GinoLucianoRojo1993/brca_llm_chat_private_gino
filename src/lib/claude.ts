/**
 * Wrapper para la API de mensajes de Anthropic.
 * Maneja autenticación y formato de request/response.
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const SYSTEM_PROMPT = `Sos un asistente especializado en las APIs públicas del Banco Central de la República Argentina (BCRA).
Tu rol es explicar datos financieros en lenguaje claro y accesible para usuarios argentinos.
Respondé siempre en español. Sé conciso y preciso.
Cuando presentes datos numéricos, usá formato argentino (punto para miles, coma para decimales si aplica).
No inventes datos — solo interpretá la información que se te proporciona.`;

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
}

export async function callClaude(userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  const messages: AnthropicMessage[] = [
    { role: "user", content: userMessage },
  ];

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }

  const data = (await res.json()) as AnthropicResponse;
  const block = data.content.find((b) => b.type === "text");
  if (!block) throw new Error("Respuesta vacía de Claude");
  return block.text;
}

interface AnthropicStreamEvent {
  type: string;
  delta?: { type: string; text?: string };
}

/**
 * Llama a la Messages API con streaming y devuelve un stream de texto plano
 * (ya extraído de los eventos SSE `content_block_delta` / `text_delta`).
 */
export async function streamClaude(userMessage: string): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  const messages: AnthropicMessage[] = [{ role: "user", content: userMessage }];

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      stream: true,
      messages,
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as AnthropicStreamEvent;
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        } catch {
          // Ignorar líneas SSE no parseables (pings, etc.)
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}
