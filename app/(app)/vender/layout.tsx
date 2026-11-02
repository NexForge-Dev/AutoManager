import type { Metadata } from "next";

// A página é client-side; o título da aba vem deste layout.
export const metadata: Metadata = {
  title: "Nova venda · AutoManager",
  description: "Registre uma venda.",
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
