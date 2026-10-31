import { describe, it, expect, beforeEach } from "vitest";
import type Stripe from "stripe";
import { tratarEventoStripe, planoDaAssinatura, statusInterno, type BillingStore, type AssinaturaAtual, type GravarAssinatura } from "./stripeSync";

// ---------------------------------------------------------------- dublês
function memoriaStore(inicial: Record<string, AssinaturaAtual> = {}, clientes: Record<string, string> = {}) {
  const assinaturas = { ...inicial };
  const processados = new Set<string>();
  const gravacoes: { orgId: string; dados: GravarAssinatura }[] = [];
  const store: BillingStore = {
    async jaProcessado(id) {
      return processados.has(id);
    },
    async marcarProcessado(id) {
      processados.add(id);
    },
    async assinaturaDaOrg(orgId) {
      return assinaturas[orgId] ?? null;
    },
    async orgDoCliente(customerId) {
      return clientes[customerId] ?? null;
    },
    async gravar(orgId, dados) {
      gravacoes.push({ orgId, dados });
      assinaturas[orgId] = {
        plano: dados.plano ?? assinaturas[orgId]?.plano ?? "ambulante",
        status: dados.status,
        providerAssinaturaId: dados.providerAssinaturaId,
      };
    },
  };
  return { store, assinaturas, gravacoes };
}

const FIM = 1_900_000_000; // unix
const INICIO_CICLO = FIM - 30 * 86_400;
function sub(over: Partial<Stripe.Subscription> & { lookup?: string | null; amount?: number } = {}): Stripe.Subscription {
  const { lookup = "automanager_equipe", amount = 9900, ...rest } = over;
  return {
    id: "sub_novo",
    status: "active",
    customer: "cus_1",
    metadata: { org_id: "org-1", plano: "equipe" },
    start_date: 1_800_000_000,
    cancel_at_period_end: false,
    items: {
      data: [{ id: "si_1", current_period_start: INICIO_CICLO, current_period_end: FIM, price: { lookup_key: lookup, unit_amount: amount } }],
    },
    ...rest,
  } as unknown as Stripe.Subscription;
}

function evento(type: string, object: unknown, id = "evt_" + Math.random()): Stripe.Event {
  return { id, type, data: { object } } as unknown as Stripe.Event;
}

// ---------------------------------------------------------------- testes
describe("planoDaAssinatura", () => {
  it("usa o lookup_key do preço (segue trocas de plano)", () => {
    expect(planoDaAssinatura(sub({ lookup: "automanager_expansao", metadata: { plano: "solo" } }))).toBe("expansao");
  });
  it("cai no metadata quando o preço não tem lookup_key", () => {
    expect(planoDaAssinatura(sub({ lookup: null, metadata: { plano: "solo" } }))).toBe("solo");
  });
  it("rejeita plano desconhecido", () => {
    expect(planoDaAssinatura(sub({ lookup: "automanager_vip", metadata: {} }))).toBeNull();
  });
});

describe("statusInterno", () => {
  it.each([
    ["active", "active"],
    ["trialing", "active"],
    ["past_due", "active"], // carência: o Stripe ainda está tentando cobrar
    ["unpaid", "past_due"],
    ["paused", "past_due"],
    ["canceled", "canceled"],
    ["incomplete_expired", "canceled"],
    ["incomplete", null],
  ])("%s -> %s", (stripe, interno) => {
    expect(statusInterno(stripe as Stripe.Subscription.Status)).toBe(interno);
  });
});

describe("tratarEventoStripe", () => {
  let mem: ReturnType<typeof memoriaStore>;
  beforeEach(() => {
    mem = memoriaStore({ "org-1": { plano: "ambulante", status: "trialing", providerAssinaturaId: null } });
  });

  it("checkout concluído ativa o plano com o estado relido do Stripe", async () => {
    const r = await tratarEventoStripe(
      evento("checkout.session.completed", { mode: "subscription", subscription: "sub_novo", client_reference_id: "org-1", metadata: {} }),
      mem.store,
      async () => sub()
    );
    expect(r.resultado).toBe("sincronizada");
    expect(r.orgId).toBe("org-1");
    expect(mem.gravacoes[0].dados).toMatchObject({
      plano: "equipe",
      status: "active",
      precoCentavos: 9900,
      providerClienteId: "cus_1",
      providerAssinaturaId: "sub_novo",
      dataFim: new Date(FIM * 1000).toISOString(),
      limparTrial: true,
    });
  });

  it("é idempotente pelo id do evento", async () => {
    const ev = evento("customer.subscription.updated", sub(), "evt_fixo");
    await tratarEventoStripe(ev, mem.store, async () => sub());
    const r = await tratarEventoStripe(ev, mem.store, async () => sub());
    expect(r.resultado).toBe("duplicado");
    expect(mem.gravacoes).toHaveLength(1);
  });

  it("não confia no payload: usa o snapshot atual (evento velho não ressuscita assinatura cancelada)", async () => {
    mem.assinaturas["org-1"] = { plano: "equipe", status: "canceled", providerAssinaturaId: "sub_novo" };
    await tratarEventoStripe(evento("customer.subscription.updated", sub({ status: "active" })), mem.store, async () =>
      sub({ status: "canceled" })
    );
    expect(mem.gravacoes[0].dados.status).toBe("canceled");
  });

  it("evento de uma assinatura antiga encerrada não derruba a assinatura nova (bug do MP)", async () => {
    mem.assinaturas["org-1"] = { plano: "expansao", status: "active", providerAssinaturaId: "sub_atual" };
    const r = await tratarEventoStripe(evento("customer.subscription.deleted", { id: "sub_velha" }), mem.store, async () =>
      sub({ id: "sub_velha", status: "canceled" })
    );
    expect(r.resultado).toBe("ignorado_substituida");
    expect(mem.gravacoes).toHaveLength(0);
  });

  it("assinatura nova ativa substitui a anterior e pede para cancelar a antiga", async () => {
    mem.assinaturas["org-1"] = { plano: "solo", status: "active", providerAssinaturaId: "sub_antiga" };
    const r = await tratarEventoStripe(evento("customer.subscription.created", { id: "sub_novo" }), mem.store, async () => sub());
    expect(r.resultado).toBe("sincronizada");
    expect(r.cancelarAnterior).toBe("sub_antiga");
    expect(r.planoAnterior).toBe("solo");
  });

  it("cobrança recusada mantém o acesso só pela carência (data_fim = início do ciclo não pago)", async () => {
    mem.assinaturas["org-1"] = { plano: "equipe", status: "active", providerAssinaturaId: "sub_novo" };
    const r = await tratarEventoStripe(
      evento("invoice.payment_failed", { parent: { subscription_details: { subscription: "sub_novo" } } }),
      mem.store,
      async () => sub({ status: "past_due" })
    );
    expect(r.resultado).toBe("sincronizada");
    expect(r.pagamentoFalhou).toBe(true);
    expect(mem.gravacoes[0].dados.status).toBe("active");
    // planoEfetivo derruba para o piso 3 dias depois de data_fim
    expect(mem.gravacoes[0].dados.dataFim).toBe(new Date(INICIO_CICLO * 1000).toISOString());
  });

  it("depois das novas tentativas (unpaid) perde o plano", async () => {
    mem.assinaturas["org-1"] = { plano: "equipe", status: "active", providerAssinaturaId: "sub_novo" };
    await tratarEventoStripe(evento("customer.subscription.updated", { id: "sub_novo" }), mem.store, async () =>
      sub({ status: "unpaid" })
    );
    expect(mem.gravacoes[0].dados.status).toBe("past_due");
    expect(mem.gravacoes[0].dados.limparTrial).toBe(false);
  });

  it("aceita o formato antigo de invoice (invoice.subscription)", async () => {
    let pedido = "";
    await tratarEventoStripe(evento("invoice.paid", { subscription: "sub_x" }), mem.store, async (id) => {
      pedido = id;
      return sub({ id: "sub_x" });
    });
    expect(pedido).toBe("sub_x");
  });

  it("primeiro pagamento pendente (incomplete) não altera nada", async () => {
    const r = await tratarEventoStripe(evento("customer.subscription.created", { id: "sub_novo" }), mem.store, async () =>
      sub({ status: "incomplete" })
    );
    expect(r.resultado).toBe("aguardando_pagamento");
    expect(mem.gravacoes).toHaveLength(0);
  });

  it("descobre a org pelo cliente quando falta metadata", async () => {
    mem = memoriaStore({ "org-2": { plano: "ambulante", status: "trialing", providerAssinaturaId: null } }, { cus_1: "org-2" });
    const r = await tratarEventoStripe(evento("customer.subscription.updated", { id: "sub_novo" }), mem.store, async () =>
      sub({ metadata: {} })
    );
    expect(r.orgId).toBe("org-2");
    expect(r.resultado).toBe("sincronizada");
  });

  it("ignora loja apagada (sem org) em vez de falhar e fazer o Stripe reenviar", async () => {
    mem = memoriaStore();
    const r = await tratarEventoStripe(evento("customer.subscription.deleted", { id: "sub_novo" }), mem.store, async () =>
      sub({ status: "canceled", metadata: {} })
    );
    expect(r.resultado).toBe("ignorado_sem_org");
  });

  it("ignora checkout que não é de assinatura e eventos desconhecidos", async () => {
    expect((await tratarEventoStripe(evento("checkout.session.completed", { mode: "payment" }), mem.store, async () => sub())).resultado).toBe("ignorado");
    expect((await tratarEventoStripe(evento("charge.refunded", {}), mem.store, async () => sub())).resultado).toBe("ignorado");
  });
});
