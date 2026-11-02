import type { Metadata } from "next";

// A página é client-side; o título da aba vem deste layout.
export const metadata: Metadata = {
  title: "Entrar · AutoManager",
  description: "Entre ou crie a conta da sua loja no AutoManager.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
