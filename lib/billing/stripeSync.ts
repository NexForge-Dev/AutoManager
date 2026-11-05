// ============================================================================
// Sincronização das assinaturas do Stripe com a tabela `assinatura`.
// Lógica pura (sem Supabase/Stripe reais) para poder ser testada: a persistência
// entra pelo BillingStore e a leitura da assinatura pelo fetchSubscription.
//
// Regras:
//  - Nunca confiamos no payload do evento: a assinatura é RELIDA do Stripe e
//    esse snapshot é gravado. O Stripe não garante ordem dos eventos, então um
//    evento velho não ressuscita assinatura cancelada nem desfaz renovação.
//  - Idempotente: cada evento é processado uma vez (stripe_evento) e toda
//    gravação é um update por org, então reenvios são seguros.
//  - Uma linha de assinatura por org: evento de uma assinatura antiga já
//    encerrada não substitui a assinatura viva atual.
// ============================================================================

import type Stripe from "stripe";
import { MIN_TRIAL_STRIPE_MS, PLANOS, planoValido, type PlanoId, type StatusAssinatura } from "../plans";

export const PREFIXO_LOOKUP = "automanager_";

export interface AssinaturaAtual {
  plano: PlanoId;
  status: StatusAssinatura;
  providerAssinaturaId: string | null;
  // fim do teste grátis do AutoManager (ms), se houver
  trialAte?: number | null;
}

export interface GravarAssinatura {
  plano: PlanoId;
  status: StatusAssinatura;
  precoCentavos: number;
  dataInicio: string | null;
  dataFim: string | null;
  providerClienteId: string;
  providerAssinaturaId: string;
  // assinatura cobrando de verdade encerra o trial interno do AutoManager
  limparTrial: boolean;
}

export interface BillingStore {
  jaProcessado(eventId: string): Promise<boolean>;
  marcarProcessado(eventId: string, tipo: string): Promise<void>;
  assinaturaDaOrg(orgId: string): Promise<AssinaturaAtual | null>;
  orgDoCliente(customerId: string): Promise<string | null>;
  gravar(orgId: string, dados: GravarAssinatura): Promise<void>;
}

export type FetchSubscription = (id: string) => Promise<Stripe.Subscription>;

export type Resultado =
  | "sincronizada"
  | "duplicado"
  | "ignorado"
  | "ignorado_sem_org"
  | "ignorado_plano_desconhecido"
  | "ignorado_substituida"
  | "aguardando_pagamento";

export interface ResultadoEvento {
  resultado: Resultado;
  orgId?: string;
  plano?: PlanoId;
  planoAnterior?: PlanoId;
  statusAnterior?: StatusAssinatura;
  status?: StatusAssinatura;
  // assinatura antiga a cancelar no Stripe (quando uma nova a substituiu)
  cancelarAnterior?: string;
  // evento de cobrança recusada (métrica payment_failed)
  pagamentoFalhou?: boolean;
  // assinatura sincronizada (para cancelar outras mais antigas do mesmo cliente)
  assinaturaId?: string;
  clienteId?: string;
  criadaEm?: number; // unix (s)
  // ---- métricas (Painel NexForge): valor REAL cobrado, não o preço de tabela ----
  precoCentavos?: number; // preço recorrente do item (unit_amount)
  emTrialStripe?: boolean; // assinatura em trial no Stripe (assinou durante o teste grátis)
  valorPagoCentavos?: number | null; // amount_paid da última fatura (com cupom/desconto), se disponível
  // evento invoice.paid: 1ª cobrança depois do trial (é aí que a assinatura "paga" de verdade)
  primeiraCobrancaPosTrial?: { valorCentavos: number } | null;
}

export interface MetricaCobranca {
  evento: "plan_activated" | "plan_changed" | "plan_canceled" | "payment_failed";
  props: Record<string, string | number>;
  chave: string;
}

/**
 * Qual métrica de cobrança enviar ao Painel NexForge (EVENTS.md) para uma sincronização.
 * - plan_activated leva o valor efetivamente cobrado (amount_paid da fatura, com cupom),
 *   e só quando há cobrança: quem assina durante o teste grátis (trial no Stripe) só
 *   "ativa" na 1ª fatura paga depois do trial.
 * - chave de plan_activated = assinatura: confirmação e webhook não contam duas vezes.
 */
export function metricaCobranca(r: ResultadoEvento, chave: string): MetricaCobranca | null {
  if (r.resultado !== "sincronizada" || !r.plano) return null;
  if (r.pagamentoFalhou) return { evento: "payment_failed", props: {}, chave: `recusa:${chave}` };
  const id = r.assinaturaId ?? chave;
  const ativar = (valor: number) => ({
    evento: "plan_activated" as const,
    props: { plan: r.plano!, billing_period: "month", amount_cents: valor, currency: "BRL" },
    chave: `ativa:${id}`,
  });
  if (r.primeiraCobrancaPosTrial && r.status === "active") return ativar(r.primeiraCobrancaPosTrial.valorCentavos);
  if (r.status === "active" && r.statusAnterior === "active" && r.planoAnterior && r.planoAnterior !== r.plano)
    return {
      evento: "plan_changed",
      props: {
        from_plan: r.planoAnterior,
        to_plan: r.plano,
        billing_period: "month",
        amount_cents: r.precoCentavos ?? PLANOS[r.plano].precoCentavos,
      },
      chave: `troca:${chave}`,
    };
  if (r.status === "active" && r.statusAnterior !== "active") {
    if (r.emTrialStripe) return null; // ainda não cobrou nada: ativa na 1ª fatura paga
    return ativar(r.valorPagoCentavos ?? r.precoCentavos ?? PLANOS[r.plano].precoCentavos);
  }
  if (r.status === "canceled" && r.statusAnterior !== "canceled")
    return { evento: "plan_canceled", props: { plan: r.plano }, chave: `cancelada:${chave}` };
  return null;
}

const VIVOS: StatusAssinatura[] = ["active", "past_due"];


/**
 * Quem assina DURANTE o teste grátis não perde o resto do "1º mês grátis": a
 * assinatura nasce em trial no Stripe até o fim do teste interno e a 1ª cobrança
 * acontece só nessa data. Devolve o trial_end (unix, segundos) ou null quando
 * não há teste vigente (ou falta menos de 48 h: cobra já).
 */
export function trialEndParaCheckout(
  atual: { status?: string | null; trial_ate?: string | null } | null | undefined,
  agora = Date.now()
): number | null {
  if (!atual || atual.status !== "trialing" || !atual.trial_ate) return null;
  const fim = new Date(atual.trial_ate).getTime();
  if (!Number.isFinite(fim) || fim - agora < MIN_TRIAL_STRIPE_MS) return null;
  return Math.floor(fim / 1000);
}

const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);

function ehPlano(p: unknown): p is PlanoId {
  return planoValido(p);
}

// Plano atual da assinatura. Os preços criados pelo `npm run stripe:sync` têm o
// lookup_key `automanager_<plano>`, que acompanha trocas de plano; o metadata só
// diz com qual plano a assinatura começou.
export function planoDaAssinatura(sub: Stripe.Subscription): PlanoId | null {
  const lookup = sub.items?.data?.[0]?.price?.lookup_key;
  if (lookup?.startsWith(PREFIXO_LOOKUP)) {
    const p = lookup.slice(PREFIXO_LOOKUP.length);
    return ehPlano(p) ? p : null;
  }
  const meta = sub.metadata?.plano;
  return ehPlano(meta) ? meta : null;
}

// status do Stripe -> status interno. null = ainda não decidiu (1º pagamento pendente).
// past_due = cobrança recusada e o Stripe ainda tentando de novo: segue "active", mas com
// data_fim no início do ciclo não pago, então a carência de planoEfetivo (3 dias) é que
// decide até quando o acesso continua. Esgotadas as tentativas, vira unpaid/canceled.
export function statusInterno(s: Stripe.Subscription.Status): StatusAssinatura | null {
  switch (s) {
    case "active":
    case "trialing":
    case "past_due":
      return "active";
    case "unpaid":
    case "paused":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return null; // incomplete
  }
}

// amount_paid da última fatura quando ela veio expandida (retrieve com expand latest_invoice)
function valorPago(sub: Stripe.Subscription): number | null {
  const inv = (sub as any).latest_invoice;
  if (!inv || typeof inv === "string") return null;
  return inv.status === "paid" && typeof inv.amount_paid === "number" ? inv.amount_paid : null;
}

function idDe(x: string | { id: string } | null | undefined): string | null {
  if (!x) return null;
  return typeof x === "string" ? x : x.id;
}

// a invoice aponta a assinatura em lugares diferentes conforme a versão da API
function assinaturaDaInvoice(inv: any): string | null {
  return idDe(inv?.parent?.subscription_details?.subscription) ?? idDe(inv?.subscription);
}

async function sincronizar(
  subId: string,
  store: BillingStore,
  fetchSubscription: FetchSubscription,
  orgFallback?: string | null
): Promise<ResultadoEvento> {
  const sub = await fetchSubscription(subId);
  const customerId = idDe(sub.customer as any) ?? "";
  const orgId = sub.metadata?.org_id || orgFallback || (customerId ? await store.orgDoCliente(customerId) : null);
  if (!orgId) return { resultado: "ignorado_sem_org" };

  const plano = planoDaAssinatura(sub);
  if (!plano) return { resultado: "ignorado_plano_desconhecido", orgId };

  const status = statusInterno(sub.status);
  if (!status) return { resultado: "aguardando_pagamento", orgId, plano };

  const atual = await store.assinaturaDaOrg(orgId);
  if (!atual) return { resultado: "ignorado_sem_org", orgId };

  const outra = atual.providerAssinaturaId && atual.providerAssinaturaId !== sub.id ? atual.providerAssinaturaId : null;
  // Assinatura encerrada que NÃO é a gravada na org não muda nada: ou é uma antiga já
  // substituída, ou nunca chegou a valer (checkout com 1º pagamento não concluído que
  // expirou: incomplete_expired). Sem isso, um boleto/3DS abandonado durante o teste
  // grátis gravava "canceled" e derrubava a loja para o piso no meio do trial.
  if (atual.providerAssinaturaId !== sub.id && !VIVOS.includes(status)) {
    return { resultado: "ignorado_substituida", orgId, plano };
  }

  // Desde a API 2025-03-31 o período de cobrança fica nos itens da assinatura.
  // O Stripe avança current_period_end assim que gera a fatura de renovação, mesmo sem
  // pagamento; em past_due o ciclo pago terminou no início do período atual.
  const item = sub.items?.data?.[0];

  // Quem assina no teste grátis mantém o que o teste promete até a data dele: a assinatura
  // nasce em trial no Stripe e a linha segue "trialing" (o banco e planoEfetivo liberam o
  // Expansão). Cancelar nesse período também não tira o resto do teste.
  const emTesteInterno = atual.status === "trialing" && !!atual.trialAte && atual.trialAte > Date.now();
  const cancelouNoTeste = emTesteInterno && status === "canceled";
  const statusFinal: StatusAssinatura = emTesteInterno && (sub.status === "trialing" || cancelouNoTeste) ? "trialing" : status;

  const fimPago =
    sub.status === "past_due"
      ? item?.current_period_start ?? (sub as any).current_period_start
      : item?.current_period_end ?? (sub as any).current_period_end;
  await store.gravar(orgId, {
    plano,
    status: statusFinal,
    precoCentavos: item?.price?.unit_amount ?? PLANOS[plano].precoCentavos,
    dataInicio: iso(sub.start_date),
    dataFim: cancelouNoTeste ? null : iso(fimPago),
    providerClienteId: customerId,
    providerAssinaturaId: sub.id,
    limparTrial: statusFinal === "active",
  });

  return {
    resultado: "sincronizada",
    orgId,
    plano,
    planoAnterior: atual.plano,
    statusAnterior: atual.status,
    status: statusFinal,
    cancelarAnterior: outra && VIVOS.includes(status) ? outra : undefined,
    assinaturaId: sub.id,
    clienteId: customerId || undefined,
    criadaEm: sub.created,
    precoCentavos: item?.price?.unit_amount ?? PLANOS[plano].precoCentavos,
    emTrialStripe: sub.status === "trialing",
    valorPagoCentavos: valorPago(sub),
  };
}

// `efeitos` roda ANTES de marcar o evento como processado: se ele falhar (ex.: não
// conseguiu cancelar a assinatura substituída), o evento não fica marcado e o
// Stripe reenvia — senão o reenvio virava "duplicado" e a cobrança dupla ficava.
export async function tratarEventoStripe(
  event: Stripe.Event,
  store: BillingStore,
  fetchSubscription: FetchSubscription,
  efeitos?: (r: ResultadoEvento) => Promise<void>
): Promise<ResultadoEvento> {
  if (await store.jaProcessado(event.id)) return { resultado: "duplicado" };

  let r: ResultadoEvento = { resultado: "ignorado" };
  const obj = event.data.object as any;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const subId = obj?.mode === "subscription" ? idDe(obj.subscription) : null;
      if (subId) r = await sincronizar(subId, store, fetchSubscription, obj.metadata?.org_id ?? obj.client_reference_id);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      r = await sincronizar(obj.id, store, fetchSubscription);
      break;
    case "invoice.paid":
    case "invoice.payment_failed": {
      const subId = assinaturaDaInvoice(obj);
      if (subId) r = await sincronizar(subId, store, fetchSubscription);
      if (event.type === "invoice.payment_failed" && r.resultado === "sincronizada") r.pagamentoFalhou = true;
      if (event.type === "invoice.paid" && r.resultado === "sincronizada" && subId) {
        // 1ª fatura paga depois do trial do Stripe (assinou durante o teste grátis)
        const sub = await fetchSubscription(subId);
        const fimTrial = sub.trial_end ?? null;
        const pago = typeof obj?.amount_paid === "number" ? obj.amount_paid : 0;
        const perto = (t: unknown) => typeof t === "number" && fimTrial !== null && Math.abs(t - fimTrial) < 3600;
        if (pago > 0 && fimTrial && obj?.billing_reason === "subscription_cycle" && (perto(obj.period_end) || perto(obj.period_start)))
          r.primeiraCobrancaPosTrial = { valorCentavos: pago };
      }
      break;
    }
  }

  if (efeitos) await efeitos(r);
  await store.marcarProcessado(event.id, event.type);
  return r;
}
