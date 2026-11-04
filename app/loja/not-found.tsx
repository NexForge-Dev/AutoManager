import { SearchX } from "lucide-react";
import { EstadoVazio } from "@/components/ui";

// 404 da vitrine pública (slug inexistente). Quem chega aqui é cliente final da
// loja: nada de "Ir para o painel" — só explica e aponta para quem mandou o link.
export const metadata = { title: "Loja não encontrada", robots: { index: false } };

// mesmo fundo claro e neutro da vitrine (app/loja/[slug]/page.tsx)
const TEMA = {
  "--bg": "#fafaf9",
  "--surface-alt": "#f1f0ee",
  "--text": "#1c1917",
  "--text-muted": "#6b6560",
  "--accent": "var(--brand-700)",
  colorScheme: "light",
} as React.CSSProperties;

export default function LojaNaoEncontrada() {
  return (
    <main style={TEMA} className="min-h-screen grid place-items-center px-4 bg-[var(--bg)] text-strong">
      <EstadoVazio icone={SearchX} titulo="Loja não encontrada">
        Este link pode estar incorreto ou a loja está fora do ar. Confira o endereço com quem te enviou.
      </EstadoVazio>
      <h1 className="sr-only">Loja não encontrada</h1>
    </main>
  );
}
