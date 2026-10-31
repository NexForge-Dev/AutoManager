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
import { PLANOS, type PlanoId, type StatusAssinatura } from "../plans";

export const PREFIXO_LOOKUP = "automanager_";

export interface AssinaturaAtual {
  plano: PlanoId;
  status: StatusAssinatura;
  providerAssinaturaId: string | null;
}

export interface GravarAssinatura {
  plano: PlanoId;
  status: StatusAssinatura;
  precoCentavos: number;
  dataInicio: string | null;
  dataFim: string | null;
  providerClienteId: string;
  providerAssinaturaId: string;
  // assinatura viva encerra o trial interno do AutoManager
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
}

const VIVOS: StatusAssinatura[] = ["active", "past_due"];

const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);

function ehPlano(p: unknown): p is PlanoId {
  return typeof p === "string" && p in PLANOS;
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
export function statusInterno(s: Stripe.Subscription.Status): StatusAssinatura | null {
  switch (s) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
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
  // evento de uma assinatura antiga encerrada: não mexe na assinatura viva atual
  if (outra && VIVOS.includes(atual.status) && !VIVOS.includes(status)) {
    return { resultado: "ignorado_substituida", orgId, plano };
  }

  // Desde a API 2025-03-31 o período de cobrança fica nos itens da assinatura.
  const item = sub.items?.data?.[0];
  await store.gravar(orgId, {
    plano,
    status,
    precoCentavos: item?.price?.unit_amount ?? PLANOS[plano].precoCentavos,
    dataInicio: iso(sub.start_date),
    dataFim: iso(item?.current_period_end ?? (sub as any).current_period_end),
    providerClienteId: customerId,
    providerAssinaturaId: sub.id,
    limparTrial: status === "active",
  });

  return {
    resultado: "sincronizada",
    orgId,
    plano,
    planoAnterior: atual.plano,
    statusAnterior: atual.status,
    status,
    cancelarAnterior: outra && VIVOS.includes(status) ? outra : undefined,
  };
}

export async function tratarEventoStripe(
  event: Stripe.Event,
  store: BillingStore,
  fetchSubscription: FetchSubscription
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
      break;
    }
  }

  await store.marcarProcessado(event.id, event.type);
  return r;
}
