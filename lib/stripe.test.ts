import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  subRetrieve: vi.fn(),
  subCancel: vi.fn(),
  subList: vi.fn(),
  custRetrieve: vi.fn(),
  custCreate: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class {
    subscriptions = { retrieve: h.subRetrieve, cancel: h.subCancel, list: h.subList };
    customers = { retrieve: h.custRetrieve, create: h.custCreate };
  },
}));
vi.mock("./metricas/servidor", () => ({ registrarEvento: vi.fn() }));

import { assinaturaVivaDaOrg, clienteDaOrg, limparClienteStripe, posSincronizar } from "./stripe";

const ORG = "22222222-2222-4222-8222-222222222222";
const ausente = (msg: string) => Object.assign(new Error(msg), { code: "resource_missing" });
const outroErro = () => Object.assign(new Error("Too many requests"), { code: "rate_limit" });

// service_role falso: lê a linha dada e guarda cada update com os filtros aplicados
function adminFalso(linha: Record<string, unknown> | null, erroUpdate: { message: string } | null = null) {
  const updates: { patch: Record<string, unknown>; filtros: [string, unknown][] }[] = [];
  const cliente: any = {
    from: (tabela: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: tabela === "org" ? { nome: "Loja X" } : linha, error: null }),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        const registro = { patch, filtros: [] as [string, unknown][] };
        updates.push(registro);
        const q: any = {
          eq: (coluna: string, valor: unknown) => {
            registro.filtros.push([coluna, valor]);
            return q;
          },
          then: (ok: (v: unknown) => void) => ok({ error: erroUpdate }),
        };
        return q;
      },
    }),
  };
  return { cliente, updates };
}

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  for (const m of Object.values(h)) m.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("assinaturaVivaDaOrg", () => {
  const linha = { provider: "stripe", provider_assinatura_id: "sub_velha" };

  it("devolve a assinatura viva", async () => {
    h.subRetrieve.mockResolvedValue({ id: "sub_velha", status: "active" });
    const { cliente, updates } = adminFalso(linha);
    expect(await assinaturaVivaDaOrg(cliente, ORG)).toMatchObject({ id: "sub_velha" });
    expect(updates).toEqual([]);
  });

  it("assinatura que não existe nesta chave (id de teste na chave live): null e limpa o id salvo", async () => {
    h.subRetrieve.mockRejectedValue(ausente("No such subscription: 'sub_velha'"));
    const { cliente, updates } = adminFalso(linha);
    expect(await assinaturaVivaDaOrg(cliente, ORG)).toBeNull();
    expect(updates).toHaveLength(1);
    expect(updates[0].patch).toMatchObject({ provider_assinatura_id: null });
    // só limpa se a linha ainda aponta para o id morto (não apaga uma assinatura nova)
    expect(updates[0].filtros).toEqual(
      expect.arrayContaining([["org_id", ORG], ["provider_assinatura_id", "sub_velha"]])
    );
    // plano e status não mudam: o Stripe só disse que o id não existe aqui
    expect(updates[0].patch).not.toHaveProperty("plano");
    expect(updates[0].patch).not.toHaveProperty("status");
  });

  it("falha ao limpar o id não muda a resposta (a próxima chamada tenta de novo)", async () => {
    h.subRetrieve.mockRejectedValue(ausente("No such subscription"));
    const { cliente } = adminFalso(linha, { message: "db fora" });
    expect(await assinaturaVivaDaOrg(cliente, ORG)).toBeNull();
  });

  it("qualquer outro erro do Stripe continua subindo, sem mexer no banco", async () => {
    h.subRetrieve.mockRejectedValue(outroErro());
    const { cliente, updates } = adminFalso(linha);
    await expect(assinaturaVivaDaOrg(cliente, ORG)).rejects.toThrow("Too many requests");
    expect(updates).toEqual([]);
  });
});

describe("clienteDaOrg", () => {
  it("reaproveita o cliente que existe no Stripe", async () => {
    h.custRetrieve.mockResolvedValue({ id: "cus_ok" });
    const { cliente, updates } = adminFalso({ provider_cliente_id: "cus_ok" });
    expect(await clienteDaOrg(cliente, ORG, "dono@loja.com")).toBe("cus_ok");
    expect(h.custCreate).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("primeiro cliente da loja: cria e grava, sem consultar id nenhum", async () => {
    h.custCreate.mockResolvedValue({ id: "cus_novo" });
    const { cliente, updates } = adminFalso({ provider_cliente_id: null });
    expect(await clienteDaOrg(cliente, ORG, "dono@loja.com")).toBe("cus_novo");
    expect(h.custRetrieve).not.toHaveBeenCalled();
    expect(h.custCreate.mock.calls[0][1]).toEqual({ idempotencyKey: `cliente-org-${ORG}` });
    expect(updates[0].patch).toMatchObject({ provider_cliente_id: "cus_novo" });
  });

  it.each([
    ["inexistente nesta chave (id de teste na chave live)", () => h.custRetrieve.mockRejectedValue(ausente("No such customer: 'cus_velho'"))],
    ["apagado no Stripe", () => h.custRetrieve.mockResolvedValue({ id: "cus_velho", deleted: true })],
  ])("cliente %s: troca por um novo e grava", async (_nome, preparar) => {
    preparar();
    h.custCreate.mockResolvedValue({ id: "cus_novo" });
    const { cliente, updates } = adminFalso({ provider_cliente_id: "cus_velho" });
    expect(await clienteDaOrg(cliente, ORG, "dono@loja.com")).toBe("cus_novo");
    expect(updates[0].patch).toMatchObject({ provider_cliente_id: "cus_novo" });
    // chave própria: a chave de sempre devolveria o cliente antigo por até 24 h
    expect(h.custCreate.mock.calls[0][1].idempotencyKey).not.toBe(`cliente-org-${ORG}`);
    expect(h.custCreate.mock.calls[0][1].idempotencyKey).toContain("cus_velho");
  });

  it("qualquer outro erro do Stripe continua subindo, sem criar cliente", async () => {
    h.custRetrieve.mockRejectedValue(outroErro());
    const { cliente } = adminFalso({ provider_cliente_id: "cus_velho" });
    await expect(clienteDaOrg(cliente, ORG, "dono@loja.com")).rejects.toThrow("Too many requests");
    expect(h.custCreate).not.toHaveBeenCalled();
  });
});

describe("limparClienteStripe", () => {
  it("zera cliente e assinatura, só se a linha ainda aponta para o cliente morto", async () => {
    const { cliente, updates } = adminFalso(null);
    await limparClienteStripe(cliente, ORG, "cus_velho");
    expect(updates[0].patch).toMatchObject({ provider_cliente_id: null, provider_assinatura_id: null });
    expect(updates[0].filtros).toEqual(
      expect.arrayContaining([["org_id", ORG], ["provider_cliente_id", "cus_velho"]])
    );
  });
});

describe("posSincronizar", () => {
  const r = {
    resultado: "sincronizada" as const,
    orgId: ORG,
    plano: "solo" as const,
    status: "active" as const,
    assinaturaId: "sub_nova",
    cancelarAnterior: "sub_velha",
  };

  it("assinatura anterior que não existe nesta chave não derruba o webhook (o Stripe reenviaria sem fim)", async () => {
    h.subRetrieve.mockRejectedValue(ausente("No such subscription"));
    await expect(posSincronizar(r, "evt_1", true)).resolves.toBeUndefined();
    expect(h.subCancel).not.toHaveBeenCalled();
  });

  it("outro erro ao cancelar a anterior continua falhando no modo estrito", async () => {
    h.subRetrieve.mockRejectedValue(outroErro());
    await expect(posSincronizar(r, "evt_1", true)).rejects.toThrow("Too many requests");
  });
});
