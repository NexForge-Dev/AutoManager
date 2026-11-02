import { describe, it, expect, vi, beforeEach } from "vitest";

// dono logado (client do servidor) + service_role falsos
const DONO = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const ALVO = "33333333-3333-4333-8333-333333333333";
let alvo: any = null;
let erroCreate: { message: string } | null = null;
let erroDelete: { message: string } | null = null;
const createUser = vi.fn(async () =>
  erroCreate ? { data: null, error: erroCreate } : { data: { user: { id: ALVO } }, error: null }
);
const deleteUser = vi.fn(async () => ({ error: erroDelete }));

function consulta(resposta: () => unknown) {
  const b: any = new Proxy(
    {},
    { get: (_t, p) => (p === "then" ? (ok: (v: unknown) => void) => ok(resposta()) : () => b) }
  );
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: DONO } } }) },
    from: () => consulta(() => ({ data: { org_id: ORG, role: "owner" }, error: null })),
  }),
}));
vi.mock("@/lib/metricas/servidor", () => ({ registrarEvento: vi.fn(), enviarMetricas: vi.fn(async () => {}) }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (t: string) =>
      consulta(() =>
        t === "assinatura"
          ? { data: { plano: "expansao", status: "active", preco_centavos: 0 }, error: null }
          : { data: alvo, error: null, count: 0 }
      ),
    auth: { admin: { createUser, deleteUser } },
  }),
}));

import { POST, DELETE } from "./route";

const req = (method: string, body: unknown) =>
  new Request("http://localhost/api/membros", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const base = { nome: "Ana", email: "ana@loja.com", senha: "senha-forte-1", role: "vendedor" };

describe("POST /api/membros (validação)", () => {
  beforeEach(() => {
    alvo = null;
    erroCreate = null;
    createUser.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it.each([
    [{ ...base, senha: "1234567" }, /mín\. 8/],
    [{ ...base, senha: "x".repeat(73) }, /máximo 72/],
    [{ ...base, email: "%@loja.com" }, /E-mail inválido/],
    [{ ...base, email: "sem-arroba" }, /E-mail inválido/],
    [{ ...base, nome: "x".repeat(121) }, /Nome muito longo/],
    [{ ...base, role: "owner" }, /Papel inválido/],
  ])("recusa %j com 400 sem criar usuário", async (body, msg) => {
    const res = await POST(req("POST", body));
    expect(res.status).toBe(400);
    expect((await res.json()).erro).toMatch(msg);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("aceita senha de 8 caracteres", async () => {
    alvo = { id: ALVO, org_id: ORG, role: "vendedor" };
    const res = await POST(req("POST", { ...base, senha: "12345678" }));
    expect(res.status).toBe(200);
  });

  it.each([
    ["A user with this email address has already been registered", "E-mail já cadastrado"],
    ["Database error creating new user", /limite do seu plano/],
    ["Password should contain at least one character of each", /pelo menos 8/],
    ["something internal and unexpected", "Não foi possível criar o membro agora. Tente novamente."],
  ])("erro do GoTrue %s vira mensagem em pt-BR (nunca crua)", async (gotrue, esperado) => {
    erroCreate = { message: gotrue };
    const res = await POST(req("POST", base));
    expect(res.status).toBe(400);
    const { erro } = await res.json();
    expect(erro).toMatch(esperado);
    expect(erro).not.toContain(gotrue);
  });
});

describe("DELETE /api/membros", () => {
  beforeEach(() => {
    erroDelete = null;
    deleteUser.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("não apaga um dono (nem co-dono da mesma loja)", async () => {
    alvo = { org_id: ORG, role: "owner" };
    const res = await DELETE(req("DELETE", { id: ALVO }));
    expect(res.status).toBe(403);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("apaga vendedor da própria loja", async () => {
    alvo = { org_id: ORG, role: "vendedor" };
    const res = await DELETE(req("DELETE", { id: ALVO }));
    expect(res.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith(ALVO);
  });

  it("id que não é uuid volta 400 sem consultar", async () => {
    const res = await DELETE(req("DELETE", { id: { $ne: 1 } }));
    expect(res.status).toBe(400);
  });

  it("falha do GoTrue no delete não vaza a mensagem crua", async () => {
    alvo = { org_id: ORG, role: "motoboy" };
    erroDelete = { message: "internal: sql: connection reset" };
    const res = await DELETE(req("DELETE", { id: ALVO }));
    expect(res.status).toBe(500);
    expect((await res.json()).erro).not.toMatch(/sql|connection/);
  });
});
