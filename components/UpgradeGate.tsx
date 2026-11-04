"use client";
import Link from "next/link";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import Modal from "./Modal";
import type { PlanoDef } from "@/lib/plans";
import { brlPreco } from "@/lib/plans";
import { usePlano, type SituacaoAssinatura } from "@/lib/usePlano";

// Conta no piso por falta de pagamento: o bloqueio não é "plano pequeno", é
// assinatura sem pagamento ativo; o upgrade sugerido não resolveria sozinho.
const AVISO_BLOQUEIO: Partial<Record<SituacaoAssinatura, string>> = {
  sem_assinatura: "Sua loja ainda não tem um plano ativo, por isso os recursos pagos estão bloqueados.",
  trial_vencido: "Seu teste grátis terminou, por isso os recursos pagos estão bloqueados até você assinar.",
  cancelada: "Sua assinatura foi cancelada, por isso os recursos pagos estão bloqueados até você assinar de novo.",
  pendente: "O pagamento da sua assinatura está pendente, por isso os recursos pagos estão bloqueados até ser regularizado.",
};

function AvisoBloqueio() {
  const { bloqueado, situacao } = usePlano();
  if (!bloqueado) return null;
  return (
    <p role="alert" className="text-sm text-bad max-w-md mx-auto">
      {AVISO_BLOQUEIO[situacao]}
    </p>
  );
}

// Bloco de página inteira para recursos bloqueados (ex.: analytics avançado).
export function UpgradeBlock({
  titulo,
  descricao,
  planoNecessario,
}: {
  titulo: string;
  descricao: string;
  planoNecessario?: PlanoDef | null;
}) {
  return (
    <div className="card text-center py-10 px-5 space-y-3">
      <span className="mx-auto grid place-items-center h-11 w-11 rounded-xl tone-brand" aria-hidden>
        <Lock size={21} />
      </span>
      <div>
        <div className="text-lg font-bold leading-tight">{titulo}</div>
        <p className="text-sm text-muted max-w-md mx-auto mt-1">{descricao}</p>
      </div>
      <AvisoBloqueio />
      <Link href="/planos" className="btn-primary w-auto max-w-full text-center">
        <Sparkles size={16} aria-hidden />
        {planoNecessario
          ? `Desbloquear com o ${planoNecessario.nome} · ${brlPreco(planoNecessario.precoCentavos)}/mês`
          : "Ver planos"}
      </Link>
    </div>
  );
}

// Modal para ações bloqueadas (ex.: tentar criar vendedor/4ª revendedora).
export function UpgradeModal({
  aberto,
  onClose,
  titulo,
  descricao,
  planoNecessario,
}: {
  aberto: boolean;
  onClose: () => void;
  titulo: string;
  descricao: string;
  planoNecessario?: PlanoDef | null;
}) {
  if (!aberto) return null;
  return (
    <Modal onClose={onClose} titulo={titulo} largura="md:max-w-sm" className="space-y-4">
      <div className="text-center space-y-4">
        <span className="mx-auto grid place-items-center h-11 w-11 rounded-xl tone-brand" aria-hidden>
          <Sparkles size={21} />
        </span>
        <p className="text-sm text-muted">{descricao}</p>
        <AvisoBloqueio />

        {planoNecessario && (
          <div className="border border-brand-500/30 bg-brand-500/[.06] p-3.5 text-left" style={{ borderRadius: "var(--r-card)" }}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">Plano {planoNecessario.nome}</span>
              <span className="text-accent font-bold tnum whitespace-nowrap">{brlPreco(planoNecessario.precoCentavos)}/mês</span>
            </div>
            <ul className="mt-2 space-y-1">
              {planoNecessario.beneficios.slice(0, 4).map((b) => (
                <li key={b} className="text-xs text-muted flex items-center gap-1.5">
                  <ArrowRight size={12} className="text-accent shrink-0" aria-hidden /> {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link href="/planos" className="btn-primary w-full">
          <Sparkles size={16} aria-hidden /> Fazer upgrade
        </Link>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-strong w-full min-h-[44px]">
          Agora não
        </button>
      </div>
    </Modal>
  );
}
