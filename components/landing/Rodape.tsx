import Link from "next/link";
import { Gem } from "lucide-react";
import { EMPRESA, linhaEmpresa, whatsappEmpresa } from "@/lib/empresa";

const LINK = "inline-flex min-h-[40px] items-center transition hover:text-strong sm:min-h-[32px]";

// Rodapé institucional: usado na landing e nas páginas legais.
// Dados da empresa vêm de lib/empresa.ts: campo vazio não aparece.
export default function Rodape({ ancoras = false }: { ancoras?: boolean }) {
  const empresa = linhaEmpresa();
  const whatsapp = whatsappEmpresa("Preciso de ajuda com o AutoManager");
  const email = EMPRESA.emailSuporte;
  return (
    <footer className="border-t border-default pb-24 pt-10 sm:pb-10">
      <div className="mx-auto max-w-6xl px-4 text-sm text-muted sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-accent">
              <Gem size={17} aria-hidden /> AutoManager
            </Link>
            <p className="mt-2 max-w-xs leading-relaxed">Gestão simples para pequenos negócios do Brasil.</p>
          </div>
          <nav aria-label="Produto">
            <h2 className="mb-1 font-semibold text-strong">Produto</h2>
            <ul>
              {ancoras && (
                <>
                  <li><a href="#planos" className={LINK}>Planos</a></li>
                  <li><a href="#faq" className={LINK}>Dúvidas</a></li>
                </>
              )}
              <li><Link href="/login" className={LINK}>Criar conta</Link></li>
              <li><Link href="/login?modo=entrar" className={LINK}>Entrar</Link></li>
              <li><Link href="/acesso" className={LINK}>Área da vendedora</Link></li>
            </ul>
          </nav>
          <nav aria-label="Documentos legais">
            <h2 className="mb-1 font-semibold text-strong">Legal</h2>
            <ul>
              <li><Link href="/termos" className={LINK}>Termos de Uso</Link></li>
              <li><Link href="/privacidade" className={LINK}>Privacidade</Link></li>
              <li><Link href="/cancelamento" className={LINK}>Cancelamento</Link></li>
            </ul>
          </nav>
          {(whatsapp || email) && (
            <div>
              <h2 className="mb-1 font-semibold text-strong">Suporte</h2>
              <ul>
                {whatsapp && (
                  <li>
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={LINK}>WhatsApp</a>
                  </li>
                )}
                {email && (
                  <li>
                    <a href={`mailto:${email}`} className={`${LINK} break-all`}>{email}</a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-8 space-y-1 border-t border-default pt-5 text-xs">
          <p>© {new Date().getFullYear()} {EMPRESA.nomeFantasia}. Todos os direitos reservados.</p>
          {empresa && <p>{empresa}</p>}
          {EMPRESA.cidadeUf && <p>{EMPRESA.cidadeUf}</p>}
        </div>
      </div>
    </footer>
  );
}
