import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Gem } from "lucide-react";

export type ItemEntrada = { icone: LucideIcon; titulo: string; texto: string };

// Moldura das telas de entrada (/login, /acesso, /redefinir-senha). Com `lado`, o
// desktop ganha uma coluna com a promessa do produto; no celular fica só o formulário.
export default function EntradaShell({
  lado,
  children,
}: {
  lado?: { titulo: string; itens: ItemEntrada[] };
  children: React.ReactNode;
}) {
  return (
    <div className={`min-h-[100dvh] bg-[var(--bg)] ${lado ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
      {lado && (
        <aside className="hidden lg:flex flex-col justify-between border-r border-default surface px-12 py-10 xl:px-20">
          <Marca />
          <div className="max-w-md">
            <p className="text-[2.25rem] font-bold leading-[1.12] tracking-tight text-strong">{lado.titulo}</p>
            <ul className="mt-8 space-y-5">
              {lado.itens.map(({ icone: Icone, titulo, texto }) => (
                <li key={titulo} className="flex gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg tone-brand" aria-hidden>
                    <Icone size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-strong">{titulo}</span>
                    <span className="block text-sm text-muted">{texto}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <span aria-hidden />
        </aside>
      )}
      <div className="flex min-h-[100dvh] flex-col items-center px-5 py-8 sm:justify-center">
        <div className="w-full max-w-sm reveal">
          <div className={`mb-8 flex justify-center ${lado ? "lg:hidden" : ""}`}>
            <Marca />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Marca() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-accent">
      <Gem size={21} aria-hidden /> AutoManager
    </Link>
  );
}
