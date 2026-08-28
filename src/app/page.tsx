"use client";

import { useState, useRef, useEffect, FormEvent } from "react";

// ============================================================
// BCRA Chat — Desarrollado por Gino Luciano Rojo
// linkedin.com/in/gino-luciano-rojo/
//
// Easter egg #1: Escribí "konami" en el chat para activarlo.
// Easter egg #2: Escribí "quien hizo esto" para ver los créditos.
// Easter egg #3: Klick 5 veces en el logo 🏦 para modo oscuro.
//
// Stack: Next.js 15 · TypeScript · Claude Sonnet 4.6 · BCRA APIs
// OWASP Top 10 secured (A01–A10) — v1.1.0 — Apr 2026
// ============================================================

interface Message {
  role: "user" | "assistant";
  content: string;
  /** Puntos [fecha, valor] cuando la respuesta trae una serie temporal (X-Bcra-Series). */
  chart?: [string, number][];
}

const SUGGESTIONS = [
  "Listame las variables monetarias del BCRA",
  "Qué cotización tenía el EUR el 2024-06-12",
  "Mostrame la evolución del USD entre 2024-06-01 y 2024-06-30",
  "Traé la situación crediticia actual del CUIT 20123456789",
];

// Konami sequence detector
const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const konamiRef = useRef<string[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Easter egg #1: Konami code → muestra créditos
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      konamiRef.current = [...konamiRef.current, e.key].slice(-KONAMI.length);
      if (konamiRef.current.join(",") === KONAMI.join(",")) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "⬆⬆⬇⬇⬅➡⬅➡🅱🅰\n\n🎉 Konami code activado!\n\nEste proyecto fue desarrollado por **Gino Luciano Rojo**.\n🔗 linkedin.com/in/gino-luciano-rojo/\n\nStack: Next.js 15 · TypeScript · Claude Sonnet 4.6 · APIs BCRA · OWASP Top 10 tested",
          },
        ]);
        konamiRef.current = [];
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Easter egg #2: "quien hizo esto" en el input
  useEffect(() => {
    if (input.toLowerCase().includes("quien hizo esto") || input.toLowerCase().includes("quién hizo esto")) {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: input },
        {
          role: "assistant",
          content:
            "👨‍💻 Este proyecto fue desarrollado por **Gino Luciano Rojo**.\n\n📌 LinkedIn: linkedin.com/in/gino-luciano-rojo/\n\n🛡️ Testeado contra OWASP Top 10\n⚡ Stack: Next.js 15 · TypeScript · Claude Sonnet 4.6 · APIs BCRA\n📅 Versión 1.1.0 — Mayo 2026",
        },
      ]);
      setInput("");
    }
  }, [input]);

  // Easter egg #3: 5 clicks en el logo → dark mode
  function handleLogoClick() {
    const next = logoClicks + 1;
    setLogoClicks(next);
    if (next >= 5) {
      setDarkMode((d) => !d);
      setLogoClicks(0);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });

      const contentType = res.headers.get("Content-Type") ?? "";

      // Respuestas cortas sin streaming: faltan parámetros, error de validación, fallback.
      if (contentType.includes("application/json")) {
        const data = (await res.json()) as { reply?: string; error?: string };
        const reply = data.reply ?? data.error ?? "Sin respuesta.";
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        return;
      }

      if (!res.body) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Sin respuesta." }]);
        return;
      }

      const chartHeader = res.headers.get("X-Bcra-Series");
      let chart: [string, number][] | undefined;
      if (chartHeader) {
        try {
          chart = JSON.parse(chartHeader) as [string, number][];
        } catch {
          chart = undefined;
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "", chart }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const snapshot = acc;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], content: snapshot };
          return next;
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error de conexión. Intentá de nuevo." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const pageStyle: React.CSSProperties = {
    ...styles.page,
    ...(darkMode ? { background: "#0f172a", color: "#e2e8f0" } : {}),
  };
  const mainStyle: React.CSSProperties = {
    ...styles.main,
    ...(darkMode ? { background: "#0f172a" } : {}),
  };

  return (
    <div style={pageStyle}>
      <header style={styles.header}>
        {/* Easter egg #3: 5 clicks en el logo */}
        <span style={{ ...styles.logo, cursor: "pointer" }} onClick={handleLogoClick} title="BCRA Chat">🏦</span>
        <div style={{ flex: 1 }}>
          <h1 style={styles.title}>BCRA Chat</h1>
          <p style={styles.subtitle}>Consultá las APIs del BCRA en lenguaje natural</p>
        </div>
        {/* Insignia OWASP Top 10 */}
        <div style={styles.owaspBadge} title="Secured against OWASP Top 10 — A01–A10 mitigated">
          <svg
            width="22"
            height="26"
            viewBox="0 0 22 26"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M11 0L0 4.5V13C0 19.075 4.7 24.74 11 26C17.3 24.74 22 19.075 22 13V4.5L11 0Z"
              fill="#4ade80"
            />
            <path
              d="M11 2.4L2 6.3V13C2 18.1 6.1 22.9 11 24.1C15.9 22.9 20 18.1 20 13V6.3L11 2.4Z"
              fill="#16a34a"
            />
            <path
              d="M9.5 16.5L5.5 12.5L6.9 11.1L9.5 13.7L15.1 8.1L16.5 9.5L9.5 16.5Z"
              fill="white"
            />
          </svg>
          <div>
            <div style={styles.owaspLabel}>OWASP</div>
            <div style={styles.owaspText}>Top 10 ✓</div>
          </div>
        </div>
      </header>

      <main style={mainStyle}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            <p style={styles.emptyTitle}>¿Qué querés consultar?</p>
            <div style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  style={styles.suggestion}
                  onClick={() => setInput(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              ...styles.bubble,
              ...(m.role === "user" ? styles.userBubble : styles.assistantBubble),
            }}
          >
            <span style={styles.roleLabel}>
              {m.role === "user" ? "Vos" : "BCRA Chat"}
            </span>
            <p style={styles.bubbleText}>{m.content}</p>
            {m.chart && m.chart.length > 1 && (
              <SeriesChart points={m.chart} dark={darkMode} />
            )}
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div style={{ ...styles.bubble, ...styles.assistantBubble }}>
            <span style={styles.roleLabel}>BCRA Chat</span>
            <p style={{ ...styles.bubbleText, opacity: 0.5 }}>Consultando...</p>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      <form style={styles.form} onSubmit={handleSubmit}>
        <input
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribí tu consulta sobre el BCRA..."
          disabled={loading}
          autoFocus
        />
        <button style={styles.sendBtn} type="submit" disabled={loading || !input.trim()}>
          Enviar
        </button>
      </form>

      <footer style={styles.footer}>
        Desarrollado por{" "}
        <a
          href="https://linkedin.com/in/gino-luciano-rojo/"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.footerLink}
        >
          Gino Luciano Rojo
        </a>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gráfico de línea para series temporales (SVG inline, sin librerías)
// ---------------------------------------------------------------------------

const CHART_W = 560;
const CHART_H = 160;
const CHART_PAD = { top: 12, right: 12, bottom: 20, left: 48 };

function formatValor(v: number): string {
  return v.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function SeriesChart({ points, dark }: { points: [string, number][]; dark: boolean }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const colors = dark
    ? { series: "#3987e5", surface: "#1a1a19", grid: "#2c2c2a", textPrimary: "#ffffff", textMuted: "#898781" }
    : { series: "#2a78d6", surface: "#fcfcfb", grid: "#e1e0d9", textPrimary: "#0b0b0b", textMuted: "#898781" };

  const plotW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const plotH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;

  const values = points.map((p) => p[1]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const x = (i: number) =>
    CHART_PAD.left + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => CHART_PAD.top + (1 - (v - min) / range) * plotH;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * CHART_W;
    const ratio = points.length > 1 ? (relX - CHART_PAD.left) / plotW : 0;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1))));
    setHoverIdx(idx);
  }

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;
  const tooltipX = hoverIdx !== null ? Math.min(Math.max(x(hoverIdx), CHART_PAD.left + 40), CHART_W - 46) : 0;

  return (
    <div style={{ marginTop: 10 }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        width="100%"
        height={CHART_H}
        role="img"
        aria-label="Gráfico de evolución de la serie"
      >
        <line
          x1={CHART_PAD.left} y1={CHART_PAD.top + plotH}
          x2={CHART_W - CHART_PAD.right} y2={CHART_PAD.top + plotH}
          stroke={colors.grid} strokeWidth={1}
        />
        <text x={CHART_PAD.left - 6} y={CHART_PAD.top + 4} textAnchor="end" fontSize={10} fill={colors.textMuted}>
          {formatValor(max)}
        </text>
        <text x={CHART_PAD.left - 6} y={CHART_PAD.top + plotH} textAnchor="end" fontSize={10} fill={colors.textMuted}>
          {formatValor(min)}
        </text>
        <text x={CHART_PAD.left} y={CHART_H - 4} fontSize={10} fill={colors.textMuted}>
          {points[0][0]}
        </text>
        <text x={CHART_W - CHART_PAD.right} y={CHART_H - 4} textAnchor="end" fontSize={10} fill={colors.textMuted}>
          {last[0]}
        </text>

        <path d={path} fill="none" stroke={colors.series} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(last[1])} r={5} fill={colors.series} stroke={colors.surface} strokeWidth={2} />
        <text x={x(points.length - 1) - 8} y={y(last[1]) - 8} textAnchor="end" fontSize={11} fontWeight={700} fill={colors.textPrimary}>
          {formatValor(last[1])}
        </text>

        {hovered && hoverIdx !== null && (
          <>
            <line
              x1={x(hoverIdx)} y1={CHART_PAD.top} x2={x(hoverIdx)} y2={CHART_PAD.top + plotH}
              stroke={colors.textMuted} strokeWidth={1} strokeDasharray="2,2"
            />
            <circle cx={x(hoverIdx)} cy={y(hovered[1])} r={4} fill={colors.series} stroke={colors.surface} strokeWidth={2} />
            <g transform={`translate(${tooltipX - 40}, ${CHART_PAD.top})`}>
              <rect width={80} height={28} rx={4} fill={colors.surface} stroke={colors.grid} strokeWidth={1} />
              <text x={40} y={11} textAnchor="middle" fontSize={9} fill={colors.textMuted}>{hovered[0]}</text>
              <text x={40} y={22} textAnchor="middle" fontSize={10} fontWeight={700} fill={colors.textPrimary}>
                {formatValor(hovered[1])}
              </text>
            </g>
          </>
        )}

        <rect
          x={CHART_PAD.left} y={0} width={plotW} height={CHART_H}
          fill="transparent"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
        />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estilos inline (sin dependencias de CSS-in-JS)
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    maxWidth: 780,
    margin: "0 auto",
    background: "#fff",
    boxShadow: "0 0 40px rgba(0,0,0,0.08)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 24px",
    borderBottom: "1px solid #e5e7eb",
    background: "#1a3a5c",
    color: "#fff",
  },
  logo: { fontSize: 32 },
  title: { margin: 0, fontSize: 20, fontWeight: 700 },
  subtitle: { margin: 0, fontSize: 13, opacity: 0.75 },
  main: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  empty: {
    margin: "auto",
    textAlign: "center",
    maxWidth: 520,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 16,
  },
  suggestions: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  suggestion: {
    background: "#f0f4f8",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    color: "#1a3a5c",
    textAlign: "left",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 12,
    padding: "10px 14px",
    lineHeight: 1.55,
  },
  userBubble: {
    alignSelf: "flex-end",
    background: "#1a3a5c",
    color: "#fff",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    background: "#f0f4f8",
    color: "#1a1a2e",
    border: "1px solid #e5e7eb",
  },
  roleLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    opacity: 0.6,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  bubbleText: {
    margin: 0,
    fontSize: 15,
    whiteSpace: "pre-wrap",
  },
  form: {
    display: "flex",
    gap: 10,
    padding: "14px 24px",
    borderTop: "1px solid #e5e7eb",
    background: "#fff",
  },
  input: {
    flex: 1,
    padding: "10px 14px",
    fontSize: 15,
    border: "1px solid #d1d5db",
    borderRadius: 8,
    outline: "none",
    color: "#1a1a2e",
  },
  sendBtn: {
    padding: "10px 20px",
    background: "#1a3a5c",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    opacity: 1,
  },
  footer: {
    textAlign: "center",
    padding: "8px 24px",
    fontSize: 12,
    color: "#6b7280",
    borderTop: "1px solid #e5e7eb",
    background: "#fff",
  },
  footerLink: {
    color: "#1a3a5c",
    fontWeight: 600,
    textDecoration: "none",
  },
  owaspBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(74,222,128,0.5)",
    borderRadius: 8,
    padding: "5px 10px",
    cursor: "default",
    flexShrink: 0,
  },
  owaspLabel: {
    fontSize: 10,
    fontWeight: 800,
    color: "#4ade80",
    letterSpacing: "0.08em",
    lineHeight: 1.2,
  },
  owaspText: {
    fontSize: 10,
    fontWeight: 600,
    color: "#fff",
    lineHeight: 1.2,
    opacity: 0.85,
  },
};
