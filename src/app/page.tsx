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
      const data = (await res.json()) as { reply?: string; error?: string };
      const reply = data.reply ?? data.error ?? "Sin respuesta.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
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
          </div>
        ))}

        {loading && (
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
