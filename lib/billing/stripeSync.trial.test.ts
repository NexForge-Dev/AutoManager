import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { tratarEventoStripe, type AssinaturaAtual, type BillingStore, type GravarAssinatura } from "./stripeSync";
import { assinouNoTrial, planoEfetivo, type Assinatura } from "../plans";

// AUT-008: assinar durante o teste grátis não corta o que o teste promete.
const DIA = 86_400_000;
const FIM_TRIAL = Date.now() + 20 * DIA;

function loja(atual: Partial<AssinaturaAtual> = {}) {
  const estado: { atual: AssinaturaAtual; gravado: GravarAssinatura | null } = {
    atual: { plano: "solo", status: "trialing", providerAssinaturaId: null, trialAte: FIM_TRIAL, ...atual },
    gravado: null,
  };
  const store: BillingStore = {
    jaProcessado: async () => false,
    marcarProcessado: async () => {},
    assinaturaDaOrg: async () => estado.atual,
    orgDoCliente: async () => "org-1",
    gravar: async (_o, d) => {
      estado.gravado = d;
      estado.atual = {
        ...estado.atual,
        plano: d.plano,
        status: d.status,
        providerAssinaturaId: d.providerAssinaturaId,
        trialAte: d.limparTrial ? null : estado.atual.trialAte,
      };
    },
  };
  return { estado, store };
}

const sub = (status: string) =>
  ({
    id: "sub_1",
    status,
    customer: "cus_1",
    metadata: { org_id: "org-1", plano: "solo" },
    start_date: 1_800_000_000,
    trial_end: Math.floor(FIM_TRIAL / 1000),
    items: {
      data: [
        {
          current_period_start: 1_800_000_000,
          current_period_end: Math.floor(FIM_TRIAL / 1000),
          price: { lookup_key: "automanager_solo", unit_amount: 4900 },
        },
      ],
    },
  }) as unknown as Stripe.Subscription;

const evento = (type: string, s: Stripe.Subscription) =>
  ({ id: "evt_" + Math.random(), type, data: { object: s } }) as unknown as Stripe.Event;

const comoAssinatura = (g: GravarAssinatura, trialAte: number | null): Assinatura => ({
  plano: g.plano,
  status: g.status,
  precoCentavos: g.precoCentavos,
  periodo: "mensal",
  dataInicio: null,
  dataFim: g.dataFim ? new Date(g.dataFim).getTime() : null,
  trialAte,
});

describe("assinar durante o teste grátis", () => {
  it("segue com o Expansão até o fim do teste e guarda o plano contratado", async () => {
    const { estado, store } = loja();
    const s = sub("trialing");
    await tratarEventoStripe(evento("customer.subscription.created", s), store, async () => s);
    expect(estado.gravado?.status).toBe("trialing");
    expect(estado.gravado?.limparTrial).toBe(false);
    const a = comoAssinatura(estado.gravado!, FIM_TRIAL);
    expect(planoEfetivo(a)).toBe("expansao");
    expect(a.plano).toBe("solo");
    expect(assinouNoTrial(a)).toBe(true);
  });

  it("acabou o teste e o Stripe ativou: vale o plano pago", async () => {
    const { estado, store } = loja({ providerAssinaturaId: "sub_1" });
    const s = sub("active");
    await tratarEventoStripe(evento("customer.subscription.updated", s), store, async () => s);
    expect(estado.gravado?.status).toBe("active");
    expect(estado.gravado?.limparTrial).toBe(true);
  });

  it("cancelou no portal durante o teste: volta ao teste, não cai no piso", async () => {
    const { estado, store } = loja({ providerAssinaturaId: "sub_1" });
    const s = sub("canceled");
    await tratarEventoStripe(evento("customer.subscription.deleted", s), store, async () => s);
    expect(estado.gravado?.status).toBe("trialing");
    expect(estado.gravado?.dataFim).toBeNull();
    expect(estado.gravado?.limparTrial).toBe(false);
    const a = comoAssinatura(estado.gravado!, FIM_TRIAL);
    expect(planoEfetivo(a)).toBe("expansao");
    expect(assinouNoTrial(a)).toBe(false);
  });

  it("cancelou depois de o teste acabar: cancela de verdade", async () => {
    const { estado, store } = loja({ providerAssinaturaId: "sub_1", trialAte: Date.now() - DIA });
    const s = sub("canceled");
    await tratarEventoStripe(evento("customer.subscription.deleted", s), store, async () => s);
    expect(estado.gravado?.status).toBe("canceled");
  });

  it("teste sem assinatura não conta como assinado", () => {
    const a = comoAssinatura({ plano: "solo", status: "trialing", dataFim: null } as GravarAssinatura, FIM_TRIAL);
    expect(assinouNoTrial(a)).toBe(false);
  });
});
