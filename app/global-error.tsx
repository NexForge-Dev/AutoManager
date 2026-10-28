"use client";
import { useEffect } from "react";

// Substitui o layout raiz quando ele próprio falha: por isso tem <html>/<body>
// e estilos inline (o CSS global pode não ter carregado).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 20,
          background: "#141019",
          color: "#f5f3f7",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            background: "#1d1726",
            border: "1px solid #322a3e",
            borderRadius: 16,
            padding: "32px 24px",
          }}
        >
          <p style={{ margin: 0, fontWeight: 800, color: "#ec4899", fontSize: 20 }}>💎 AutoManager</p>
          <h1 style={{ margin: "20px 0 8px", fontSize: 24 }}>Algo deu errado</h1>
          <p style={{ margin: 0, color: "#a79fb4", fontSize: 14, lineHeight: 1.5 }}>
            O sistema encontrou um erro inesperado. Seus dados estão salvos. Tente recarregar a
            página.
          </p>
          {error.digest && <p style={{ color: "#a79fb4", fontSize: 12 }}>Código: {error.digest}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                background: "#db2777",
                color: "#fff",
                border: 0,
                borderRadius: 12,
                padding: "12px 18px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Tentar de novo
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                background: "#2a2235",
                color: "#f5f3f7",
                borderRadius: 12,
                padding: "12px 18px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Página inicial
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
