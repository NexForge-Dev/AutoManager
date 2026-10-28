"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Gem, RotateCcw } from "lucide-react";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-[80vh] grid place-items-center px-5 bg-[var(--bg)]">
      <div className="w-full max-w-md text-center reveal">
        <div className="mb-8 inline-flex items-center gap-2 text-xl font-extrabold text-brand-500">
          <Gem className="text-brand-600" /> AutoManager
        </div>
        <div className="card space-y-4 py-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/10 text-red-500">
            <AlertTriangle size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-strong">Algo deu errado</h1>
            <p className="mt-2 text-sm text-muted">
              Não conseguimos carregar esta tela agora. Seus dados estão salvos — tente de novo em
              alguns segundos.
            </p>
            {error.digest && <p className="mt-2 text-xs text-muted">Código: {error.digest}</p>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button onClick={reset} className="btn-primary">
              <RotateCcw size={16} /> Tentar de novo
            </button>
            <Link href="/" className="btn-ghost">
              Página inicial
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
