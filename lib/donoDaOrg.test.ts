import { beforeEach, describe, expect, it, vi } from "vitest";

let leituras: Record<string, { data: any; error: any }>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "d@t.local" } } }) },
    from: (t: string) => {
      const b: any = { select: () => b, eq: () => b, maybeSingle: async () => leituras[t] };
      return b;
    },
  }),
}));

const { donoDaOrg } = await import("./donoDaOrg");

beforeEach(() => {
  leituras = {
    usuario: { data: { org_id: "o1", role: "owner" }, error: null },
    org: { data: { id: "o1", acesso: "ativo" }, error: null },
  };
});

describe("donoDaOrg", () => {
  it("dono com loja ativa", async () => {
    expect(await donoDaOrg()).toEqual({ userId: "u1", orgId: "o1", email: "d@t.local" });
  });

  it("não é dono: null", async () => {
    leituras.usuario = { data: { org_id: "o1", role: "vendedor" }, error: null };
    expect(await donoDaOrg()).toBeNull();
  });

  it("falha de leitura lança: não é 'sem permissão'", async () => {
    leituras.usuario = { data: null, error: { message: "fora" } };
    await expect(donoDaOrg()).rejects.toThrow();
    leituras.usuario = { data: { org_id: "o1", role: "owner" }, error: null };
    leituras.org = { data: null, error: { message: "fora" } };
    await expect(donoDaOrg()).rejects.toThrow();
  });
});
