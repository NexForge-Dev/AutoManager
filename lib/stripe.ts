// ============================================================================
// Integração Stripe - assinaturas dos planos do AutoManager.
// Uso EXCLUSIVO no servidor (route handlers). STRIPE_SECRET_KEY é segredo.
//
// Fluxo: o dono escolhe um plano -> criamos uma Checkout Session (assinatura
// mensal em BRL) e redirecionamos. Quando paga, o Stripe chama o webhook e
// gravamos o plano na tabela `assinatura` (via service role). Trocas de plano de
// quem já assina atualizam a assinatura existente (sem duplicar cobrança); cartão,
// faturas e cancelamento ficam no Customer Portal do Stripe.
// ============================================================================

import Stripe from "stripe";
import { createClient as createAdmin, type SupabaseClient } from "@supabase/supabase-js";
import { PLANOS, type PlanoId } from "./plans";
import { PREFIXO_LOOKUP, metricaCobranca, type BillingStore, type ResultadoEvento } from "./billing/stripeSync";
import { registrarEvento } from "./metricas/servidor";

let cliente: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurado");
  if (!cliente) cliente = new Stripe(key, { appInfo: { name: "AutoManager" } });
  return cliente;
}

export function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    // em produção, cair no localhost geraria success_url/return_url quebrados: falha alto.
    if (process.env.NODE_ENV === "production") throw new Error("NEXT_PUBLIC_APP_URL não configurado");
    return "http://localhost:3000";
  }
  // remove barra final p/ montar URLs previsíveis
  return url.replace(/\/$/, "");
}

export function adminClient(): SupabaseClient {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const lookupDoPlano = (plano: PlanoId) => `${PREFIXO_LOOKUP}${plano}`;

// preço mensal ativo do plano (criado pelo `npm run stripe:sync`)
export async function precoDoPlano(plano: PlanoId): Promise<Stripe.Price> {
  const { data } = await stripe().prices.list({ lookup_keys: [lookupDoPlano(plano)], active: true, limit: 1 });
  if (!data[0]) throw new Error(`Preço do plano ${PLANOS[plano].nome} não configurado no Stripe (rode npm run stripe:sync)`);
  return data[0];
}

const VIVA: Stripe.Subscription.Status[] = ["active", "trialing", "past_due", "unpaid", "paused"];

// O objeto não existe para esta chave: foi apagado no Stripe ou nasceu no outro modo
// (id de teste gravado no banco e chave live em uso). Não é falha do Stripe: quem chama
// trata como "não há nada lá"; qualquer outro erro continua subindo.
export function objetoStripeAusente(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === "resource_missing";
}

// Tira do banco um id que o Stripe não reconhece. Só toca a linha se ela ainda aponta
// para esse id (não apaga o que um webhook acabou de gravar) e nunca muda plano/status.
// Falhar aqui não muda o resultado de quem chamou: a próxima chamada tenta de novo.
async function limparIdsStripe(
  admin: SupabaseClient,
  orgId: string,
  coluna: "provider_assinatura_id" | "provider_cliente_id",
  id: string,
  patch: Record<string, null>
): Promise<void> {
  const { error } = await admin
    .from("assinatura")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq(coluna, id);
  if (error) console.error("Falha ao limpar id do Stripe que não existe mais", orgId, error.message);
}

// Cliente que não existe mais: a assinatura dele também não (apagar o cliente as encerra).
export function limparClienteStripe(admin: SupabaseClient, orgId: string, clienteId: string): Promise<void> {
  return limparIdsStripe(admin, orgId, "provider_cliente_id", clienteId, {
    provider_cliente_id: null,
    provider_assinatura_id: null,
  });
}

// Assinatura Stripe ainda cobrável da org (para trocar de plano ou cancelar).
export async function assinaturaVivaDaOrg(admin: SupabaseClient, orgId: string): Promise<Stripe.Subscription | null> {
  const { data, error } = await admin
    .from("assinatura")
    .select("provider, provider_assinatura_id")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.provider !== "stripe" || !data.provider_assinatura_id) return null;
  try {
    const sub = await stripe().subscriptions.retrieve(data.provider_assinatura_id);
    return VIVA.includes(sub.status) ? sub : null;
  } catch (e) {
    if (!objetoStripeAusente(e)) throw e;
    const id = data.provider_assinatura_id;
    await limparIdsStripe(admin, orgId, "provider_assinatura_id", id, { provider_assinatura_id: null });
    return null;
  }
}

async function clienteExiste(id: string): Promise<boolean> {
  try {
    const c = await stripe().customers.retrieve(id);
    return !c.deleted;
  } catch (e) {
    if (objetoStripeAusente(e)) return false;
    throw e;
  }
}

// Cliente Stripe da org: reaproveita o já gravado se ele ainda existir, senão cria e grava.
export async function clienteDaOrg(admin: SupabaseClient, orgId: string, email: string): Promise<string> {
  const { data, error } = await admin
    .from("assinatura")
    .select("provider_cliente_id")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const salvo = data?.provider_cliente_id;
  const temSalvo = !!salvo?.startsWith("cus_");
  if (temSalvo && (await clienteExiste(salvo))) return salvo;

  const { data: org } = await admin.from("org").select("nome").eq("id", orgId).maybeSingle();
  const c = await stripe().customers.create(
    { email, name: org?.nome ?? undefined, metadata: { org_id: orgId } },
    // substituindo um cliente morto, a chave é outra: a de sempre poderia devolver
    // justamente esse cliente (o Stripe guarda a resposta por pelo menos 24 h)
    { idempotencyKey: temSalvo ? `cliente-org-${orgId}-substitui-${salvo}` : `cliente-org-${orgId}` }
  );
  const { error: e2 } = await admin
    .from("assinatura")
    .update({ provider_cliente_id: c.id, updated_at: new Date().toISOString() })
    .eq("org_id", orgId);
  if (e2) throw new Error(e2.message);
  return c.id;
}

// Efeitos depois de sincronizar: cancela a assinatura substituída (para não
// cobrar dois planos) e manda as métricas ao Painel NexForge. `chave` deixa os
// eventos idempotentes (id do evento Stripe ou da sessão de checkout).
// `estrito` (webhook): falha ao cancelar a assinatura anterior LANÇA, para o webhook
// responder 500 e o Stripe reenviar o evento (o plano novo já foi gravado; o reenvio
// é idempotente). Nos caminhos disparados pelo usuário só registra no log.
export async function posSincronizar(r: ResultadoEvento, chave: string, estrito = false): Promise<void> {
  if (r.resultado !== "sincronizada" || !r.orgId || !r.plano) return;

  // Uma assinatura viva por loja: cancela a substituída (cancelarAnterior) e qualquer
  // outra assinatura viva MAIS ANTIGA do mesmo cliente (a mais nova vence). Listar no
  // Stripe cobre o reenvio do webhook depois de uma falha: o banco já aponta para a
  // nova, então cancelarAnterior não viria de novo.
  if (r.status === "active" && r.assinaturaId) {
    try {
      const alvo = new Set<string>();
      if (r.cancelarAnterior) alvo.add(r.cancelarAnterior);
      if (r.clienteId && r.criadaEm) {
        const { data } = await stripe().subscriptions.list({ customer: r.clienteId, status: "all", limit: 20 });
        for (const s of data)
          if (s.id !== r.assinaturaId && VIVA.includes(s.status) && s.created < r.criadaEm) alvo.add(s.id);
      }
      for (const id of alvo) {
        if (id === r.assinaturaId) continue;
        try {
          const antiga = await stripe().subscriptions.retrieve(id);
          if (VIVA.includes(antiga.status) || antiga.status === "incomplete") await stripe().subscriptions.cancel(id);
        } catch (e) {
          // a anterior nem existe nesta chave: não há o que cancelar (senão o webhook
          // responderia 500 para sempre e o Stripe reenviaria o evento sem fim)
          if (!objetoStripeAusente(e)) throw e;
        }
      }
    } catch (e) {
      console.error("Falha ao cancelar assinatura Stripe anterior", r.cancelarAnterior ?? "", e);
      if (estrito) throw e;
    }
  }

  const m = metricaCobranca(r, chave);
  if (m) registrarEvento(m.evento, r.orgId, m.props, m.chave);
}

// Lê a assinatura com a última fatura (amount_paid real, com cupom/desconto) para as métricas.
export function lerAssinatura(id: string): Promise<Stripe.Subscription> {
  return stripe().subscriptions.retrieve(id, { expand: ["latest_invoice"] });
}

// Sincronização disparada por nós (volta do checkout, troca de plano), não por um
// evento real do Stripe: não registra em stripe_evento, pode repetir à vontade
// (a gravação é um snapshot idempotente).
export function semIdempotencia(store: BillingStore): BillingStore {
  return { ...store, jaProcessado: async () => false, marcarProcessado: async () => {} };
}

// Persistência do webhook no Supabase (service role).
export function supabaseBillingStore(admin: SupabaseClient): BillingStore {
  return {
    async jaProcessado(id) {
      const { data, error } = await admin.from("stripe_evento").select("id").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return !!data;
    },
    async marcarProcessado(id, tipo) {
      const { error } = await admin.from("stripe_evento").upsert({ id, tipo }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    },
    async assinaturaDaOrg(orgId) {
      const { data, error } = await admin
        .from("assinatura")
        .select("plano, status, provider, provider_assinatura_id")
        .eq("org_id", orgId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        plano: data.plano,
        status: data.status,
        // ids de outro provedor (legado Mercado Pago) não contam como assinatura Stripe
        providerAssinaturaId: data.provider === "stripe" ? data.provider_assinatura_id : null,
      };
    },
    async orgDoCliente(customerId) {
      const { data, error } = await admin
        .from("assinatura")
        .select("org_id")
        .eq("provider_cliente_id", customerId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data?.org_id as string) ?? null;
    },
    async gravar(orgId, d) {
      const { error } = await admin
        .from("assinatura")
        .update({
          plano: d.plano,
          status: d.status,
          preco_centavos: d.precoCentavos,
          periodo: "mensal",
          ...(d.dataInicio ? { data_inicio: d.dataInicio } : {}),
          data_fim: d.dataFim,
          ...(d.limparTrial ? { trial_ate: null } : {}),
          provider: "stripe",
          provider_cliente_id: d.providerClienteId,
          provider_assinatura_id: d.providerAssinaturaId,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", orgId);
      if (error) throw new Error(error.message);
    },
  };
}
