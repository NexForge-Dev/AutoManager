import { SearchX } from "lucide-react";

// 404 da vitrine pública (slug inexistente). Quem chega aqui é cliente final da
// loja: nada de "Ir para o painel" — só explica e aponta para quem mandou o link.
export const metadata = { title: "Loja não encontrada", robots: { index: false } };

export default function LojaNaoEncontrada() {
  return (
    <main className="min-h-screen grid place-items-center px-5 bg-[var(--bg)]">
      <div className="w-full max-w-md text-center">
        <div className="card space-y-4 py-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
            <SearchX size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-strong">Loja não encontrada</h1>
            <p className="mt-2 text-sm text-muted">
              Este link pode estar incorreto ou a loja está fora do ar. Confira o endereço com quem te enviou.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
