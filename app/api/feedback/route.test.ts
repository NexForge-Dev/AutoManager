import { describe, it, expect, vi, beforeEach } from "vitest";

const USUARIO = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const EMAIL = "dona@loja.com";

let user: any;
let erroInsert: { message: string } | null;
let limiteOk: boolean;
const inserts: any[] = [];
const rpc = vi.fn(async () => ({ data: limiteOk, error: null }));
const feedback = vi.fn(async (): Promise<boolean> => true);

function consulta(resposta: () => unknown) {
  const b: any = new Proxy(
    {},
    { get: (_t, p) => (p === "then" ? (ok: (v: unknown) => void) => ok(resposta()) : () => b) }
  );
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: (t: string) => ({
      insert: async (linha: any) => {
        inserts.push(linha);
        return { error: erroInsert };
      },
      select: () => consulta(() => ({ data: t === "org" ? { nome: "Loja da Ana" } : { org_id: ORG }, error: null })),
    }),
  }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
// o cliente real (lib/metricas/servidor.ts) segue valendo; só o SDK é falso
vi.mock("@/lib/metricas/nexforge-client.cjs", () => ({ createNexforge: () => ({ feedback }) }));

const { POST } = await import("./route");

const pedir = (corpo: unknown) =>
  POST(new Request("http://localhost/api/feedback", { method: "POST", body: JSON.stringify(corpo) }));

beforeEach(() => {
  user = { id: USUARIO, email: EMAIL };
  erroInsert = null;
  limiteOk = true;
  inserts.length = 0;
  rpc.mockClear();
  feedback.mockReset();
  feedback.mockResolvedValue(true);
});

describe("POST /api/feedback", () => {
  it("exige login e recusa a sessão anônima do chat da vitrine", async () => {
    user = null;
    expect((await pedir({ tipo: "erro", mensagem: "oi" })).status).toBe(401);
    user = { id: USUARIO, is_anonymous: true };
    expect((await pedir({ tipo: "erro", mensagem: "oi" })).status).toBe(401);
    expect(inserts).toHaveLength(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["mensagem vazia", { tipo: "erro", mensagem: "   " }],
    ["mensagem longa demais", { tipo: "erro", mensagem: "a".repeat(4001) }],
    ["tipo desconhecido", { tipo: "elogio", mensagem: "oi" }],
    ["sem corpo útil", null],
  ])("400 com %s, sem gastar o limite", async (_n, corpo) => {
    expect((await pedir(corpo)).status).toBe(400);
    expect(inserts).toHaveLength(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("aceita exatamente 4000 caracteres depois do trim", async () => {
    expect((await pedir({ tipo: "erro", mensagem: `  ${"a".repeat(4000)}  ` })).status).toBe(200);
    expect(inserts[0].mensagem).toHaveLength(4000);
  });

  it("429 acima de 10 por hora por usuário, sem gravar", async () => {
    limiteOk = false;
    const r = await pedir({ tipo: "erro", mensagem: "oi" });
    expect(r.status).toBe(429);
    expect(inserts).toHaveLength(0);
    const args = rpc.mock.calls[0] as unknown as [string, any];
    expect(args[1]).toMatchObject({ p_max: 10, p_janela_segundos: 3600 });
    expect(args[1].p_chave).toMatch(/^feedback:usuario:[0-9a-f]{64}$/);
  });

  it("falha ao gravar: 500 e nada vai para o painel", async () => {
    erroInsert = { message: "rls" };
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await pedir({ tipo: "erro", mensagem: "oi" })).status).toBe(500);
    expect(feedback).not.toHaveBeenCalled();
    erro.mockRestore();
  });

  it("grava primeiro com a loja e o e-mail da sessão; assunto derivado", async () => {
    const r = await pedir({ tipo: "sugestao", mensagem: "  mais relatórios  ", pagina: "/produtos?token=x#y" });
    expect(r.status).toBe(200);
    expect(inserts[0]).toMatchObject({
      org_id: ORG,
      usuario_id: USUARIO,
      nome_loja: "Loja da Ana",
      email_contato: EMAIL,
      tipo: "sugestao",
      assunto: "Ajude-nos a melhorar (/produtos)",
      mensagem: "mais relatórios",
    });
  });

  it("repassa ao painel o id da linha, sem identidade nem query string", async () => {
    await pedir({ tipo: "sugestao", mensagem: "mais relatórios", pagina: "/produtos?email=dona@loja.com" });
    expect(feedback).toHaveBeenCalledTimes(1);
    const [item, espera] = feedback.mock.calls[0] as unknown as [any, number];
    expect(item).toMatchObject({
      externalId: inserts[0].id,
      kind: "suggestion",
      message: "mais relatórios",
      page: "/produtos",
    });
    expect(item.occurredAt).toBeInstanceOf(Date);
    expect(espera).toBe(2500);
    const enviado = JSON.stringify(item);
    for (const proibido of [EMAIL, USUARIO, ORG, "Loja da Ana"]) expect(enviado).not.toContain(proibido);
  });

  it.each([
    ["sugestao", "suggestion"],
    ["erro", "problem"],
    ["duvida", "problem"],
  ])("%s vira %s", async (tipo, kind) => {
    await pedir({ tipo, mensagem: "oi" });
    expect((feedback.mock.calls[0] as unknown as [any])[0].kind).toBe(kind);
  });

  it("card de suporte: mantém assunto e e-mail digitados; o assunto vai junto no painel", async () => {
    await pedir({ tipo: "erro", assunto: " Venda fiado ", mensagem: "não salva", emailContato: "Outro@Mail.com" });
    expect(inserts[0]).toMatchObject({ assunto: "Venda fiado", email_contato: "outro@mail.com" });
    expect((feedback.mock.calls[0] as unknown as [any])[0].message).toBe("Venda fiado\n\nnão salva");
  });

  it("e-mail de contato inválido: 400", async () => {
    expect((await pedir({ tipo: "erro", mensagem: "oi", emailContato: "nao-e-email" })).status).toBe(400);
  });

  it("falha do painel nunca derruba o pedido", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    feedback.mockRejectedValue(new Error("painel fora do ar"));
    expect((await pedir({ tipo: "erro", mensagem: "oi" })).status).toBe(200);
    feedback.mockResolvedValue(false);
    expect((await pedir({ tipo: "erro", mensagem: "oi" })).status).toBe(200);
    expect(inserts).toHaveLength(2);
    aviso.mockRestore();
  });
});
