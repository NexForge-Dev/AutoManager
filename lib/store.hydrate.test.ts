import { beforeEach, describe, expect, it, vi } from "vitest";

// Cliente Supabase falso: cada tabela/RPC responde o que o teste mandar.
type Resp = { data: any; error: any };
const ERRO_REDE = { message: "TypeError: Failed to fetch", code: "" };
const USUARIO = { id: "u1", email: "dono@t.local", app_metadata: {} };

let respostas: Record<string, Resp>;
let getUser: () => Promise<any>;

function consulta(chave: string) {
  const r = () => respostas[chave] ?? { data: null, error: null };
  const b: any = {};
  for (const m of ["select", "eq", "gte", "lt", "order", "limit", "range", "in"]) b[m] = () => b;
  b.maybeSingle = () => Promise.resolve(r());
  b.then = (ok: any, ko: any) => Promise.resolve(r()).then(ok, ko);
  return b;
}

vi.mock("./supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: () => getUser() },
    from: (t: string) => {
      const b = consulta(t);
      // duas leituras de `usuario`: a própria (role) e a lista da equipe (membros)
      if (t === "usuario") {
        const select = b.select;
        b.select = (c: string) => (c === "role" ? consulta("usuario:eu") : select(c));
      }
      return b;
    },
    rpc: (n: string) => consulta("rpc:" + n),
  }),
}));

const { useStore } = await import("./store");

const ORG = { id: "o1", nome: "Aurora", canais: [], margem_padrao: 1, comissao_padrao: 1, onboarding_completo: true };
const ASSIN = { plano: "solo", status: "active", preco_centavos: 4900 };

beforeEach(() => {
  useStore.getState().limpar();
  getUser = async () => ({ data: { user: USUARIO }, error: null });
  respostas = {
    org: { data: ORG, error: null },
    "usuario:eu": { data: { role: "owner" }, error: null },
    usuario: { data: [], error: null },
    produto: { data: [], error: null },
    revendedora: { data: [], error: null },
    venda: { data: [], error: null },
    entrega: { data: [], error: null },
    entrada_pendente: { data: [], error: null },
    conta_pagar: { data: [], error: null },
    "rpc:minha_assinatura": { data: ASSIN, error: null },
  };
});

describe("hydrate: falha de leitura não vira ausência de dado", () => {
  it("loja vazia de verdade não acusa falha", async () => {
    await useStore.getState().hydrate();
    const s = useStore.getState();
    expect(s.ready).toBe(true);
    expect(s.semOrg).toBe(false);
    expect(s.falhaEssencial).toBe(false);
    expect(s.falhasCarga).toEqual([]);
  });

  it("sem linha em usuario (leitura ok) continua sendo semOrg", async () => {
    respostas["usuario:eu"] = { data: null, error: null };
    await useStore.getState().hydrate();
    expect(useStore.getState().semOrg).toBe(true);
    expect(useStore.getState().falhaEssencial).toBe(false);
  });

  it("AUT-002: erro ao ler usuario NÃO vira semOrg", async () => {
    respostas["usuario:eu"] = { data: null, error: ERRO_REDE };
    await useStore.getState().hydrate();
    const s = useStore.getState();
    expect(s.ready).toBe(true);
    expect(s.semOrg).toBe(false);
    expect(s.falhaEssencial).toBe(true);
  });

  it("erro ao ler org ou assinatura também é falha essencial (não some a loja nem o plano)", async () => {
    respostas.org = { data: null, error: ERRO_REDE };
    await useStore.getState().hydrate();
    expect(useStore.getState().falhaEssencial).toBe(true);

    useStore.getState().limpar();
    respostas.org = { data: ORG, error: null };
    respostas["rpc:minha_assinatura"] = { data: null, error: ERRO_REDE };
    await useStore.getState().hydrate();
    expect(useStore.getState().falhaEssencial).toBe(true);
    expect(useStore.getState().config.nomeLoja).not.toBe("Aurora");
  });

  it("sem a RPC minha_assinatura (banco sem a 0042) cai na tabela, como antes", async () => {
    respostas["rpc:minha_assinatura"] = { data: null, error: { code: "PGRST202", message: "not found" } };
    respostas.assinatura = { data: ASSIN, error: null };
    await useStore.getState().hydrate();
    expect(useStore.getState().falhaEssencial).toBe(false);
    expect(useStore.getState().assinatura?.plano).toBe("solo");
  });

  it("AUT-003: produto e venda com erro entram em falhasCarga", async () => {
    respostas.produto = { data: null, error: ERRO_REDE };
    respostas.venda = { data: null, error: ERRO_REDE };
    await useStore.getState().hydrate();
    const s = useStore.getState();
    expect(s.falhaEssencial).toBe(false);
    expect(s.falhasCarga).toEqual(expect.arrayContaining(["produtos", "vendas"]));
  });

  it("AUT-003: nova tentativa que falha não zera o que já tinha carregado", async () => {
    respostas.produto = { data: [{ id: "p1", nome: "Colar", produto_variacao: [] }], error: null };
    await useStore.getState().hydrate();
    expect(useStore.getState().produtos).toHaveLength(1);

    respostas.produto = { data: null, error: ERRO_REDE };
    await useStore.getState().hydrate();
    expect(useStore.getState().produtos).toHaveLength(1);
    expect(useStore.getState().falhasCarga).toContain("produtos");
  });

  it("tentar de novo limpa a falha quando a leitura volta", async () => {
    respostas["usuario:eu"] = { data: null, error: ERRO_REDE };
    respostas.produto = { data: null, error: ERRO_REDE };
    await useStore.getState().hydrate();
    respostas["usuario:eu"] = { data: { role: "owner" }, error: null };
    respostas.produto = { data: [], error: null };
    await useStore.getState().tentarDeNovo();
    const s = useStore.getState();
    expect(s.falhaEssencial).toBe(false);
    expect(s.falhasCarga).toEqual([]);
    expect(s.recarregando).toBe(false);
  });

  it("tabela opcional ausente (banco sem a migration) não é falha", async () => {
    respostas.conta_pagar = { data: null, error: { code: "PGRST205", message: "no table" } };
    respostas.entrada_pendente = { data: null, error: { code: "42P01", message: "no table" } };
    await useStore.getState().hydrate();
    expect(useStore.getState().falhasCarga).toEqual([]);
  });

  it("sem sessão: não é falha", async () => {
    getUser = async () => ({
      data: { user: null },
      error: { name: "AuthSessionMissingError", status: 400, message: "Auth session missing!" },
    });
    await useStore.getState().hydrate();
    expect(useStore.getState().ready).toBe(true);
    expect(useStore.getState().falhaEssencial).toBe(false);
  });

  it("auth fora do ar: é falha, não 'sem sessão'", async () => {
    getUser = async () => ({
      data: { user: null },
      error: { name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" },
    });
    await useStore.getState().hydrate();
    expect(useStore.getState().falhaEssencial).toBe(true);
  });

  it("exceção inesperada não deixa o esqueleto girando para sempre", async () => {
    getUser = async () => {
      throw new Error("boom");
    };
    await useStore.getState().hydrate();
    expect(useStore.getState().ready).toBe(true);
    expect(useStore.getState().falhaEssencial).toBe(true);
  });
});
