import { describe, it, expect, vi, beforeEach } from "vitest";

const { precoDoPlano } = vi.hoisted(() => ({
  precoDoPlano: vi.fn(async (_plano: string) => {
    throw new Error("dublê: o Stripe não é chamado nos testes");
  }),
}));
vi.mock("@/lib/donoDaOrg", () => ({
  donoDaOrg: async () => ({ userId: "u1", orgId: "o1", email: "dono@loja.com" }),
}));
vi.mock("@/lib/metricas/servidor", () => ({ registrarEvento: vi.fn(), enviarMetricas: vi.fn(async () => {}) }));
vi.mock("@/lib/billing/stripeSync", () => ({ tratarEventoStripe: vi.fn() }));
vi.mock("@/lib/stripe", () => ({
  adminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  }),
  appUrl: () => "http://localhost",
  assinaturaVivaDaOrg: vi.fn(),
  clienteDaOrg: vi.fn(),
  posSincronizar: vi.fn(),
  precoDoPlano,
  semIdempotencia: vi.fn(),
  stripe: vi.fn(),
  supabaseBillingStore: vi.fn(),
}));

import { POST } from "./route";
import { planoValido } from "@/lib/plans";

const req = (body: string) =>
  new Request("http://localhost/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/json" }, body });

describe("POST /api/stripe/checkout — validação do plano", () => {
  beforeEach(() => {
    precoDoPlano.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it.each([
    ['{"plano":"toString"}'],
    ['{"plano":"__proto__"}'],
    ['{"plano":"constructor"}'],
    ['{"plano":"hasOwnProperty"}'],
    ['{"plano":"premium"}'],
    ['{"plano":1}'],
    ['{"plano":["solo"]}'],
    ['{}'],
    ["null"],
    ["não é json"],
  ])("body %s -> 400 Plano inválido, sem chamar o Stripe", async (body) => {
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    expect((await res.json()).erro).toBe("Plano inválido");
    expect(precoDoPlano).not.toHaveBeenCalled();
  });

  it("plano válido segue para o Stripe", async () => {
    const res = await POST(req('{"plano":"equipe"}'));
    // o dublê do Stripe lança: a rota responde o 502 genérico, mas passou da validação
    expect(res.status).toBe(502);
    expect(precoDoPlano).toHaveBeenCalledWith("equipe");
  });
});

describe("planoValido", () => {
  it("só aceita as chaves próprias de PLANOS", () => {
    for (const p of ["ambulante", "solo", "equipe", "expansao"]) expect(planoValido(p)).toBe(true);
    for (const p of ["toString", "__proto__", "valueOf", "", "SOLO", null, undefined, 3, {}]) expect(planoValido(p)).toBe(false);
  });
});
