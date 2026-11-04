"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Gem, RotateCcw } from "lucide-react";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-[80vh] flex flex-col items-center justify-center gap-6 px-5 py-8 bg-[var(--bg)]">
      <div className="inline-flex items-center gap-2 text-lg font-bold text-accent">
        <Gem size={21} aria-hidden /> AutoManager
      </div>
      <div className="card w-full max-w-md p-6 text-center reveal">
        <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl tone-bad" aria-hidden>
          <AlertTriangle size={21} />
        </span>
        <h1 className="page-title">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted">
          Não conseguimos carregar esta tela agora. Seus dados estão salvos — tente de novo em
          alguns segundos.
        </p>
        {error.digest && <p className="mt-2 text-xs text-muted">Código: {error.digest}</p>}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button onClick={reset} className="btn-primary">
            <RotateCcw size={16} aria-hidden /> Tentar de novo
          </button>
          <Link href="/" className="btn-ghost">
            Página inicial
          </Link>
        </div>
      </div>
    </main>
  );
}
