import { describe, it, expect, vi, beforeEach } from "vitest";

const ORG = "22222222-2222-4222-8222-222222222222";
const DONO = "11111111-1111-4111-8111-111111111111";
const REV = "44444444-4444-4444-8444-444444444444";

const h = vi.hoisted(() => ({
  erroOrgUpdate: null as { message: string } | null,
  updateUserById: vi.fn(async (_id: string, _attrs: unknown) => ({ error: null })),
  rpc: vi.fn(async (_fn: string, _args: unknown) => ({ data: 1, error: null })),
  orgUpdates: [] as unknown[],
}));

function consulta(tabela: string) {
  let op = "select";
  const b: any = new Proxy(
    {},
    {
      get(_t, p: string) {
        if (p === "then")
          return (ok: (v: unknown) => void) => {
            if (tabela === "usuario") return ok({ data: [{ id: DONO, email: "dono@loja.com" }], error: null });
            if (tabela === "revendedora") return ok({ data: [{ user_id: REV }], error: null });
            if (tabela === "org" && op === "update") return ok({ data: null, error: h.erroOrgUpdate });
            return ok({ data: { nome: "Loja X" }, error: null });
          };
        return (...args: unknown[]) => {
          if (p === "update") {
            op = "update";
            if (tabela === "org") h.orgUpdates.push(args[0]);
          }
          return b;
        };
      },
    }
  );
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "su", email: "su@x.com", app_metadata: { role: "superadmin" } } } }) },
  }),
}));
vi.mock("@/lib/adminAudit", () => ({ registrarAdminLog: vi.fn(async () => {}) }));
vi.mock("@/lib/stripe", () => ({ assinaturaVivaDaOrg: async () => null, stripe: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (t: string) => consulta(t),
    rpc: h.rpc,
    auth: {
      admin: {
        getUserById: async (id: string) => ({ data: { user: { id, app_metadata: {} } }, error: null }),
        updateUserById: h.updateUserById,
        deleteUser: vi.fn(async () => ({ error: null })),
      },
    },
  }),
}));

import { POST } from "./route";

const req = (body: unknown) =>
  new Request("http://localhost/api/admin/usuario", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("POST /api/admin/usuario", () => {
  beforeEach(() => {
    h.erroOrgUpdate = null;
    h.orgUpdates = [];
    h.updateUserById.mockClear();
    h.rpc.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("desativar bane também as revendedoras e encerra as sessões", async () => {
    const res = await POST(req({ orgId: ORG, acao: "desativar" }));
    expect(res.status).toBe(200);
    const banidos = h.updateUserById.mock.calls.map((c) => c[0]);
    expect(banidos).toEqual(expect.arrayContaining([DONO, REV]));
    expect(h.updateUserById.mock.calls.every((c: any[]) => c[1].ban_duration !== "none")).toBe(true);
    expect(h.rpc).toHaveBeenCalledWith("admin_encerrar_sessoes", { p_usuarios: expect.arrayContaining([DONO, REV]) });
    expect(h.orgUpdates).toContainEqual({ acesso: "desativado" });
  });

  it("reativar tira o ban de membros e revendedoras (sem encerrar sessões)", async () => {
    const res = await POST(req({ orgId: ORG, acao: "reativar" }));
    expect(res.status).toBe(200);
    expect(h.updateUserById).toHaveBeenCalledWith(REV, { ban_duration: "none" });
    expect(h.updateUserById).toHaveBeenCalledWith(DONO, { ban_duration: "none" });
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.orgUpdates).toContainEqual({ acesso: "ativo" });
  });

  it("orgId que não é uuid volta 400 (antes: 500 com o erro cru do Postgres)", async () => {
    const res = await POST(req({ orgId: "lixo", acao: "banir" }));
    expect(res.status).toBe(400);
  });

  it("falha do banco não vaza a mensagem do Postgres", async () => {
    h.erroOrgUpdate = { message: 'invalid input syntax for type uuid: "x"' };
    const res = await POST(req({ orgId: ORG, acao: "banir" }));
    expect(res.status).toBe(500);
    const corpo = await res.json();
    expect(corpo.codigo).toBe("erro_interno");
    expect(JSON.stringify(corpo)).not.toMatch(/syntax|uuid/);
  });
});
