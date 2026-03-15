import type { NextConfig } from "next";

const securityHeaders = [
  // A05 – Security Misconfiguration: previene clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // A05 – previene MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // A05 – referrer policy
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // A05 – HSTS (solo HTTPS)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // A05 – Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Next.js requiere unsafe-inline para hydration
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  // A05 – Permissions Policy
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
