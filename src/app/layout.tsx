import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BCRA Chat",
  description: "Consultas sobre APIs públicas del BCRA en lenguaje natural",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
