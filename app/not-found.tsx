import Link from "next/link";
import { ArrowLeft, Gem, SearchX } from "lucide-react";

export const metadata = { title: "Página não encontrada · AutoManager" };

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center px-5 bg-[var(--bg)]">
      <div className="w-full max-w-md text-center reveal">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-xl font-extrabold text-brand-500">
          <Gem className="text-brand-600" /> AutoManager
        </Link>
        <div className="card space-y-4 py-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-500/10 text-brand-500">
            <SearchX size={26} />
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-500">Erro 404</p>
            <h1 className="mt-1 text-2xl font-bold text-strong">Página não encontrada</h1>
            <p className="mt-2 text-sm text-muted">
              O endereço pode ter mudado ou o link está incompleto. Confira se digitou certo.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/" className="btn-ghost">
              <ArrowLeft size={16} /> Página inicial
            </Link>
            <Link href="/painel" className="btn-primary">
              Ir para o painel
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
