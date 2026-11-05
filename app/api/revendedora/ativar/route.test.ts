import { describe, it, expect, vi, beforeEach } from "vitest";

// Banco falso: cada .from(tabela) devolve um builder encadeável que grava as
// chamadas (método + args) e, no await, responde conforme a tabela.
type Chamada = { tabela: string; metodo: string; args: unknown[] };
let permitido = true;
let chamadas: Chamada[] = [];
let candidatas: any[] = [];
let convites: any[] = [];
let assinatura: any = null;
let erroCreate: { message: string } | null = null;
let erroLink: { message: string } | null = null;
const rpc = vi.fn(async () => ({ data: permitido, error: null }));
const createUser = vi.fn(async () =>
  erroCreate ? { data: null, error: erroCreate } : { data: { user: { id: "user-novo" } }, error: null }
);
const deleteUser = vi.fn(async () => ({ error: null }));

function builder(tabela: string) {
  let op = "select";
  const b: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") {
          return (ok: (v: unknown) => void) => {
            if (tabela === "revendedora" && op === "update") return ok({ data: null, error: erroLink });
            if (op === "update" || op === "delete") return ok({ data: null, error: null });
            if (tabela === "revendedora") return ok({ data: candidatas, error: null });
            if (tabela === "revendedora_convite") return ok({ data: convites, error: null });
            if (tabela === "assinatura") return ok({ data: assinatura, error: null });
            return ok({ data: null, error: null });
          };
        }
        return (...args: unknown[]) => {
          chamadas.push({ tabela, metodo: prop, args });
          if (prop === "update" || prop === "delete") op = prop;
          return b;
        };
      },
    }
  );
  return b;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc, from: (t: string) => builder(t), auth: { admin: { createUser, deleteUser } } })),
}));

import { POST } from "./route";

function pedido(body: unknown, ip = "9.9.9.9") {
  return new Request("http://localhost/api/revendedora/ativar", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const valido = { email: "rev@exemplo.com", senha: "senha-forte", codigo: "ABC234" };
const futuro = new Date(Date.now() + 86_400_000).toISOString();

describe("POST /api/revendedora/ativar", () => {
  beforeEach(() => {
    permitido = true;
    chamadas = [];
    candidatas = [];
    convites = [];
    assinatura = { plano: "expansao", status: "active", trial_ate: null, data_fim: null };
    erroCreate = null;
    erroLink = null;
    rpc.mockClear();
    createUser.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("conta a tentativa por IP e por e-mail (com hash)", async () => {
    const res = await POST(pedido(valido));
    expect(res.status).toBe(403);
    expect(rpc).toHaveBeenCalledTimes(2);
    const chaves = rpc.mock.calls.map((c: any[]) => c[1].p_chave as string);
    expect(chaves[0]).toMatch(/^ativar:ip:[0-9a-f]{64}$/);
    expect(chaves[1]).toMatch(/^ativar:email:[0-9a-f]{64}$/);
    expect(chaves.join()).not.toContain("rev@exemplo.com");
    expect(chaves.join()).not.toContain("9.9.9.9");
  });

  it("responde 429 com Retry-After quando estoura o limite", async () => {
    permitido = false;
    const res = await POST(pedido(valido));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("900");
    expect((await res.json()).erro).toMatch(/Muitas tentativas/);
  });

  it("entrada inválida volta 400 sem tocar no limitador", async () => {
    const res = await POST(pedido({ email: "x@y.com", senha: "1" }));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["%@exemplo.com", "r%", "_ev@exemplo.com".replace("_", "%"), "a b@exemplo.com", "%pend%"])(
    "e-mail com curinga/metacaractere (%s) é recusado antes do banco",
    async (email) => {
      const res = await POST(pedido({ ...valido, email }));
      expect(res.status).toBe(400);
      expect(chamadas.length).toBe(0);
    }
  );

  it("busca a revendedora por igualdade EXATA do e-mail normalizado (nunca ilike)", async () => {
    await POST(pedido({ ...valido, email: "  Rev@Exemplo.COM " }));
    const filtros = chamadas.filter((c) => c.tabela === "revendedora");
    expect(filtros.some((c) => c.metodo === "ilike" || c.metodo === "like")).toBe(false);
    expect(filtros).toContainEqual({ tabela: "revendedora", metodo: "eq", args: ["email", "rev@exemplo.com"] });
  });

  async function resposta(body = valido) {
    const res = await POST(pedido(body));
    return { status: res.status, corpo: await res.json() };
  }

  it("código errado e falhas DEPOIS do código respondem igual (sem oráculo 400 x 403)", async () => {
    candidatas = [{ id: "r1", nome: "Rev", org_id: "o1", acesso_liberado: true, user_id: null, ativa: true }];
    convites = [{ revendedora_id: "r1", codigo: "ZZZ999", expira: futuro }];
    const codigoErrado = await resposta();

    convites = [{ revendedora_id: "r1", codigo: "ABC234", expira: futuro }];
    erroCreate = { message: "Database error creating new user" };
    const createErroBanco = await resposta();

    erroCreate = null;
    erroLink = { message: "duplicate key value violates unique constraint" };
    const vinculoFalhou = await resposta();

    const naoCadastrada = (candidatas = [], await resposta());

    for (const r of [createErroBanco, vinculoFalhou, naoCadastrada]) expect(r).toEqual(codigoErrado);
    expect(codigoErrado.status).toBe(403);
    expect(JSON.stringify(codigoErrado.corpo)).not.toMatch(/duplicate|Database|already/i);
  });

  it("AUT-011: com o código CERTO, e-mail que já tem conta recebe o motivo", async () => {
    candidatas = [{ id: "r1", nome: "Rev", org_id: "o1", acesso_liberado: true, user_id: null, ativa: true }];
    convites = [{ revendedora_id: "r1", codigo: "ABC234", expira: futuro }];
    erroCreate = { message: "User already registered" };
    const r = await resposta();
    erroCreate = null;
    expect(r.status).toBe(409);
    expect(JSON.stringify(r.corpo)).toMatch(/já tem uma conta/);

    // com o código errado, o mesmo e-mail não revela nada
    convites = [{ revendedora_id: "r1", codigo: "ZZZ999", expira: futuro }];
    erroCreate = { message: "User already registered" };
    const errado = await resposta();
    erroCreate = null;
    expect(errado.status).toBe(403);
  });

  it("código expirado também cai no 403 único", async () => {
    candidatas = [{ id: "r1", nome: "Rev", org_id: "o1", acesso_liberado: true, user_id: null, ativa: true }];
    convites = [{ revendedora_id: "r1", codigo: "ABC234", expira: new Date(Date.now() - 1000).toISOString() }];
    expect((await resposta()).status).toBe(403);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("caminho feliz: cria o login com papel revendedora, vincula e consome o código", async () => {
    candidatas = [{ id: "r1", nome: "Rev", org_id: "o1", acesso_liberado: true, user_id: null, ativa: true }];
    convites = [{ revendedora_id: "r1", codigo: "ABC234", expira: futuro }];
    const r = await resposta({ ...valido, codigo: "abc234" });
    expect(r).toEqual({ status: 200, corpo: { ok: true } });
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "rev@exemplo.com", app_metadata: { role: "revendedora" } })
    );
    expect(chamadas).toContainEqual({ tabela: "revendedora", metodo: "update", args: [{ user_id: "user-novo" }] });
    expect(chamadas.some((c) => c.tabela === "revendedora_convite" && c.metodo === "delete")).toBe(true);
  });
});
