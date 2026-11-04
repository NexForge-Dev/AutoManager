import { ImageResponse } from "next/og";
import { ORDEM_PLANOS, PLANOS, brlPreco } from "@/lib/plans";

export const runtime = "edge";
export const alt = "AutoManager: saiba quanto sobra das vendas da sua loja";
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
          background: "#0c0a10",
          color: "#f6f4f8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="60" height="60" viewBox="0 0 512 512">
            <rect width="512" height="512" rx="112" fill="#db2777" />
            <path d="M256 120l72 64-72 208-72-208z" fill="#fff" opacity="0.95" />
            <path d="M184 184h144l-72 64z" fill="#fbcfe8" />
          </svg>
          <div style={{ fontSize: 38, fontWeight: 700, color: "#f472b6" }}>AutoManager</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>Você vendeu hoje.</div>
          <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, color: "#f472b6" }}>
            Sobrou quanto?
          </div>
          <div style={{ marginTop: 28, fontSize: 32, color: "#a8a2b3" }}>
            Estoque, vendas, comissões e lucro no seu celular.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#f6f4f8" }}>
          {`1º mês grátis, sem cartão · Depois, a partir de ${menor}/mês`}
        </div>
      </div>
    ),
    size
  );
}
