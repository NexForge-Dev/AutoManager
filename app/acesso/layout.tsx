import type { Metadata } from "next";

// A página é client-side; o título da aba vem deste layout.
export const metadata: Metadata = {
  title: "Área da Vendedora · AutoManager",
  description: "Revendedoras e equipe da loja: acesse o catálogo e registre suas vendas.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
