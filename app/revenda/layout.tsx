import type { Metadata } from "next";

// A página é client-side; o título da aba vem deste layout.
export const metadata: Metadata = {
  title: "Minha revenda · AutoManager",
  description: "Catálogo e vendas da revendedora.",
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
