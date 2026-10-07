"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Último recurso: erro que derrubou a página inteira. Não herda o globals.css,
// por isso os estilos são inline.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "sans-serif", background: "#FAF6EE", color: "#2C2620", padding: "3rem 1rem", textAlign: "center" }}>
        <title>Erro — Controle de Dispositivos</title>
        <h1 style={{ color: "#204A41", fontSize: "1.5rem" }}>Algo deu errado</h1>
        <p>O erro foi registrado automaticamente para a equipe da UTIN.</p>
        <button
          onClick={() => retry()}
          style={{ marginTop: "1rem", minHeight: "3rem", padding: "0 1.25rem", borderRadius: "0.75rem", border: 0, background: "#2F6659", color: "white", fontWeight: 600, fontSize: "1rem" }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
