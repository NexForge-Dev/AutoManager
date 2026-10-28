import Link from "next/link";
import { ArrowLeft, Gem } from "lucide-react";
import Rodape from "@/components/landing/Rodape";

export const ULTIMA_ATUALIZACAO = "28/10/2026";

// Moldura das páginas legais (Termos, Privacidade, Cancelamento).
export default function LegalLayout({
  titulo,
  resumo,
  children,
}: {
  titulo: string;
  resumo?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-strong antialiased">
      <header className="sticky top-0 z-30 border-b border-default bg-[var(--bg)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-brand-500">
            <Gem size={20} /> AutoManager
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-strong">
            <ArrowLeft size={15} /> Voltar ao início
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{titulo}</h1>
        <p className="mt-2 text-sm text-muted">Última atualização: {ULTIMA_ATUALIZACAO}</p>
        {resumo && (
          <p className="mt-6 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-4 text-sm leading-relaxed">
            {resumo}
          </p>
        )}
        <article className="legal mt-8 space-y-8 text-[15px] leading-relaxed text-strong">{children}</article>
      </main>

      <Rodape />
    </div>
  );
}

export function Secao({ n, titulo, children }: { n: number | string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={`s${n}`} className="scroll-mt-20 space-y-3">
      <h2 className="text-xl font-bold tracking-tight">
        <span className="text-brand-500">{n}.</span> {titulo}
      </h2>
      <div className="space-y-3 text-muted [&_strong]:text-strong [&_a]:font-medium [&_a]:text-brand-500 hover:[&_a]:underline [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
