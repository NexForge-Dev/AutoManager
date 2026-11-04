import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  criarPortal: vi.fn(),
  limparClienteStripe: vi.fn(async () => {}),
  cliente: "cus_velho" as string | null,
}));

vi.mock("@/lib/donoDaOrg", () => ({
  donoDaOrg: async () => ({ userId: "u1", orgId: "o1", email: "dono@loja.com" }),
}));
vi.mock("@/lib/stripe", () => ({
  adminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { provider_cliente_id: h.cliente }, error: null }) }),
      }),
    }),
  }),
  appUrl: () => "http://localhost",
  limparClienteStripe: h.limparClienteStripe,
  objetoStripeAusente: (e: { code?: string }) => e?.code === "resource_missing",
  stripe: () => ({ billingPortal: { sessions: { create: h.criarPortal } } }),
}));

import { POST } from "./route";

describe("POST /api/stripe/portal", () => {
  beforeEach(() => {
    h.cliente = "cus_velho";
    h.criarPortal.mockReset();
    h.limparClienteStripe.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("devolve o link do portal", async () => {
    h.criarPortal.mockResolvedValue({ url: "https://billing.stripe.com/s" });
    const res = await POST();
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://billing.stripe.com/s");
    expect(h.limparClienteStripe).not.toHaveBeenCalled();
  });

  it("cliente que não existe nesta chave: limpa o id e responde como loja sem assinatura paga", async () => {
    h.criarPortal.mockRejectedValue(Object.assign(new Error("No such customer"), { code: "resource_missing" }));
    const res = await POST();
    expect(res.status).toBe(400);
    expect((await res.json()).erro).toMatch(/ainda não tem uma assinatura paga/);
    expect(h.limparClienteStripe).toHaveBeenCalledWith(expect.anything(), "o1", "cus_velho");
  });

  it("qualquer outro erro do Stripe segue como 502, sem limpar nada", async () => {
    h.criarPortal.mockRejectedValue(Object.assign(new Error("boom"), { code: "api_error" }));
    const res = await POST();
    expect(res.status).toBe(502);
    expect(h.limparClienteStripe).not.toHaveBeenCalled();
  });
});
