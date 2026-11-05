"use client";
import { useStore } from "./store";
import {
  capacidades,
  planoEfetivo,
  trialAtivo,
  assinouNoTrial,
  diasDeTrial,
  atingiuLimite,
  planoDef,
  CARENCIA_PAGAMENTO_MS,
  MIN_TRIAL_STRIPE_MS,
  type Assinatura,
  type PlanoDef,
  type PlanoId,
  type UsoRecursos,
  type Recurso,
} from "./plans";

// mesma regra do checkout (lib/plans.ts MIN_TRIAL_STRIPE_MS)
export const MIN_TRIAL_COBRANCA_MS = MIN_TRIAL_STRIPE_MS;

// Situação da assinatura para a UI (avisos e CTAs). Segue as mesmas regras de
// planoEfetivo: tudo que não é "ativa"/"trial" cai no piso (recursos pagos bloqueados).
export type SituacaoAssinatura =
  | "sem_assinatura"
  | "trial"
  | "trial_vencido"
  | "cancelada"
  | "pendente"
  | "ativa";

export function situacaoDaAssinatura(a: Assinatura | null, agora = Date.now()): SituacaoAssinatura {
  if (!a) return "sem_assinatura";
  if (a.status === "trialing") return trialAtivo(a) ? "trial" : "trial_vencido";
  if (a.status === "canceled") return "cancelada";
  if (a.status === "past_due") return "pendente";
  if (a.dataFim && a.dataFim + CARENCIA_PAGAMENTO_MS < agora) return "pendente";
  return "ativa";
}

// Hook único de assinatura/limites. Toda checagem de plano na UI passa por aqui.
export function usePlano() {
  const assinatura = useStore((s) => s.assinatura);
  const revendedoras = useStore((s) => s.revendedoras);
  const membros = useStore((s) => s.membros);

  const caps = capacidades(assinatura);
  const planoEf: PlanoId = planoEfetivo(assinatura);
  const planoContratado: PlanoId = assinatura?.plano ?? "solo";
  const emTrial = trialAtivo(assinatura);
  const situacao = situacaoDaAssinatura(assinatura);

  const uso: UsoRecursos = {
    revendedoras: revendedoras.filter((r) => r.ativa).length,
    vendedores: membros.filter((m) => m.role === "vendedor").length,
    motoboys: membros.filter((m) => m.role === "motoboy").length,
  };

  return {
    assinatura,
    caps, // PlanoDef efetivo (considera trial)
    planoEfetivo: planoEf,
    planoContratado,
    defContratado: planoDef(planoContratado),
    emTrial,
    assinadoNoTrial: assinouNoTrial(assinatura),
    diasTrial: diasDeTrial(assinatura),
    situacao,
    // sem assinatura, teste vencido, cancelada ou inadimplente: recursos pagos bloqueados
    bloqueado: situacao !== "ativa" && situacao !== "trial",
    // assinando agora, a 1ª cobrança só acontece no fim do teste grátis?
    cobrancaNoFimDoTrial:
      emTrial && !!assinatura?.trialAte && assinatura.trialAte - Date.now() > MIN_TRIAL_COBRANCA_MS,
    uso,
    // helpers de checagem
    pode: (chave: keyof PlanoDef) => Boolean(caps[chave]),
    limiteAtingido: (r: Recurso) => atingiuLimite(uso, caps, r),
  };
}
