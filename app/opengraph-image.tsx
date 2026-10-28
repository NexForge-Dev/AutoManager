import { ImageResponse } from "next/og";
import { ORDEM_PLANOS, PLANOS, brlPreco } from "@/lib/plans";

export const runtime = "edge";
export const alt = "AutoManager - Gestão simples para o seu micronegócio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const menor = brlPreco(Math.min(...ORDEM_PLANOS.map((id) => PLANOS[id].precoCentavos)));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(circle at 50% -10%, #831843 0%, #09090f 60%)",
          color: "#f5f5f7",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 512 512">
            <rect width="512" height="512" rx="112" fill="#db2777" />
            <path d="M256 120l72 64-72 208-72-208z" fill="#fff" opacity="0.95" />
            <path d="M184 184h144l-72 64z" fill="#fbcfe8" />
          </svg>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#f472b6" }}>AutoManager</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            Saiba quanto sua loja
          </div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, color: "#ec4899" }}>
            vende e lucra — todo dia.
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: "#9aa0ac" }}>
            Estoque, vendas, comissões e revendedoras num app só.
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 26 }}>
          {["1º mês grátis", `A partir de ${menor}/mês`, "Funciona no celular"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
