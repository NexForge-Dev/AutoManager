import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APARENCIA_NO_FLASH } from "@/lib/aparencia";
import { ORDEM_PLANOS, PLANOS, brlPreco } from "@/lib/plans";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const MENOR_PRECO = brlPreco(Math.min(...ORDEM_PLANOS.map((id) => PLANOS[id].precoCentavos)));

const TITULO = "AutoManager - Gestão simples para o seu micronegócio";
const DESCRICAO = `Controle de estoque, vendas, comissões e revendedoras para micronegócios: doces, bijuterias, cosméticos, roupas e muito mais. Configure do seu jeito. 1º mês grátis, depois a partir de ${MENOR_PRECO}/mês.`;

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: TITULO,
  description: DESCRICAO,
  applicationName: "AutoManager",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "AutoManager", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "AutoManager",
    title: TITULO,
    description: DESCRICAO,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRICAO,
  },
};

export const viewport: Viewport = {
  themeColor: "#db2777",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: APARENCIA_NO_FLASH }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
