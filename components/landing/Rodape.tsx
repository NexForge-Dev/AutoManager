import Link from "next/link";
import { Gem } from "lucide-react";
import { linhaEmpresa } from "@/lib/empresa";

// Rodapé institucional: usado na landing e nas páginas legais.
export default function Rodape({ ancoras = false }: { ancoras?: boolean }) {
  const empresa = linhaEmpresa();
  return (
    <footer className="border-t border-default py-10 pb-28 sm:pb-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 text-sm text-muted">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Link href="/" className="flex items-center gap-2 font-semibold text-brand-500">
            <Gem size={16} /> AutoManager
          </Link>
          <nav aria-label="Rodapé" className="flex flex-wrap justify-center gap-x-5 gap-y-0 sm:gap-y-2">
            {ancoras && (
              <>
                <a href="#planos" className="py-2.5 transition hover:text-strong sm:py-0">Planos</a>
                <a href="#faq" className="py-2.5 transition hover:text-strong sm:py-0">Dúvidas</a>
              </>
            )}
            <Link href="/termos" className="py-2.5 transition hover:text-strong sm:py-0">Termos de Uso</Link>
            <Link href="/privacidade" className="py-2.5 transition hover:text-strong sm:py-0">Privacidade</Link>
            <Link href="/cancelamento" className="py-2.5 transition hover:text-strong sm:py-0">Cancelamento</Link>
            <Link href="/login?modo=entrar" className="py-2.5 transition hover:text-strong sm:py-0">Entrar</Link>
          </nav>
        </div>
        <div className="space-y-1 text-center text-xs sm:text-left">
          <p>© {new Date().getFullYear()} AutoManager. Todos os direitos reservados.</p>
          {empresa && <p>{empresa}</p>}
        </div>
      </div>
    </footer>
  );
}
