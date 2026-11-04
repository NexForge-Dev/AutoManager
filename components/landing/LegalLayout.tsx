import Link from "next/link";
import { ArrowLeft, Gem } from "lucide-react";
import Rodape from "@/components/landing/Rodape";

export const ULTIMA_ATUALIZACAO = "02/11/2026";

// Moldura das páginas legais (Termos, Privacidade, Cancelamento).
export default function LegalLayout({
  titulo,
  resumo,
  atualizadoEm = ULTIMA_ATUALIZACAO,
  children,
}: {
  titulo: string;
  resumo?: string;
  atualizadoEm?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-strong antialiased">
      <header className="sticky top-0 z-30 border-b border-default bg-[var(--bg)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-accent">
            <Gem size={19} aria-hidden /> AutoManager
          </Link>
          <Link href="/" className="inline-flex min-h-[40px] items-center gap-1.5 text-sm text-muted transition hover:text-strong">
            <ArrowLeft size={15} aria-hidden /> Voltar ao início
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-[1.875rem] font-bold leading-tight tracking-tight sm:text-[2.25rem]">{titulo}</h1>
        <p className="mt-2 text-sm text-muted tnum">Última atualização: {atualizadoEm}</p>
        {resumo && (
          <p className="mt-6 border-l-2 border-brand-500 pl-4 text-[0.9375rem] leading-relaxed text-strong">
            {resumo}
          </p>
        )}
        <article className="legal mt-10 divide-y divide-[color:var(--border)] text-[0.9375rem] leading-[1.7] text-strong [&>section]:py-7 [&>section:first-child]:pt-0">
          {children}
        </article>
      </main>

      <Rodape />
    </div>
  );
}

export function Secao({ n, titulo, children }: { n: number | string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={`s${n}`} className="scroll-mt-20 space-y-3">
      <h2 className="text-lg font-bold tracking-tight sm:text-xl">
        <span className="text-accent tnum">{n}.</span> {titulo}
      </h2>
      <div className="space-y-3 [&_strong]:font-semibold [&_a]:font-medium [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
