import Link from "next/link";
import { ArrowLeft, Gem, SearchX } from "lucide-react";

export const metadata = { title: "Página não encontrada · AutoManager" };

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-5 py-8 bg-[var(--bg)]">
      <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-accent">
        <Gem size={21} aria-hidden /> AutoManager
      </Link>
      <div className="card w-full max-w-md p-6 text-center reveal">
        <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl tone-brand" aria-hidden>
          <SearchX size={21} />
        </span>
        <p className="text-sm font-medium text-muted">Erro 404</p>
        <h1 className="page-title mt-1">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted">
          O endereço pode ter mudado ou o link está incompleto. Confira se digitou certo.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/" className="btn-ghost">
            <ArrowLeft size={16} aria-hidden /> Página inicial
          </Link>
          <Link href="/painel" className="btn-primary">
            Ir para o painel
          </Link>
        </div>
      </div>
    </main>
  );
}
