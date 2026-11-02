import { describe, it, expect, vi, beforeEach } from "vitest";
import { chaveLimite, dentroDoLimite, ipDaRequisicao, todasDentroDoLimite, LIMITES_ATIVACAO, type RpcClient } from "./rateLimit";

// dublê com a mesma semântica de public.rate_limit_registrar (janela fixa por chave)
function bancoFalso(agora: () => number) {
  const linhas = new Map<string, { inicio: number; n: number }>();
  const chamadas: Record<string, unknown>[] = [];
  const sb: RpcClient = {
    async rpc(fn, args) {
      chamadas.push({ fn, ...args });
      const { p_chave, p_max, p_janela_segundos } = args as { p_chave: string; p_max: number; p_janela_segundos: number };
      const l = linhas.get(p_chave);
      if (!l || l.inicio <= agora() - p_janela_segundos * 1000) linhas.set(p_chave, { inicio: agora(), n: 1 });
      else l.n++;
      return { data: linhas.get(p_chave)!.n <= p_max, error: null };
    },
  };
  return { sb, chamadas, linhas };
}

describe("rate limit", () => {
  let t = 0;
  beforeEach(() => {
    t = 1_000_000;
  });

  it("libera até o máximo e bloqueia depois, dentro da janela", async () => {
    const { sb } = bancoFalso(() => t);
    const regra = { max: 3, janelaSegundos: 60 };
    const r = [];
    for (let i = 0; i < 5; i++) r.push(await dentroDoLimite(sb, "k", regra));
    expect(r).toEqual([true, true, true, false, false]);
  });

  it("zera quando a janela vence", async () => {
    const { sb } = bancoFalso(() => t);
    const regra = { max: 1, janelaSegundos: 60 };
    expect(await dentroDoLimite(sb, "k", regra)).toBe(true);
    expect(await dentroDoLimite(sb, "k", regra)).toBe(false);
    t += 61_000;
    expect(await dentroDoLimite(sb, "k", regra)).toBe(true);
  });

  it("chaves diferentes não se misturam", async () => {
    const { sb } = bancoFalso(() => t);
    const regra = { max: 1, janelaSegundos: 60 };
    expect(await dentroDoLimite(sb, "a", regra)).toBe(true);
    expect(await dentroDoLimite(sb, "b", regra)).toBe(true);
  });

  it("bloqueia se qualquer chave estourar (IP ou e-mail)", async () => {
    const { sb } = bancoFalso(() => t);
    const ip = { chave: "ip", regra: { max: 10, janelaSegundos: 60 } };
    const email = { chave: "email", regra: { max: 2, janelaSegundos: 60 } };
    expect(await todasDentroDoLimite(sb, [ip, email])).toBe(true);
    expect(await todasDentroDoLimite(sb, [ip, email])).toBe(true);
    expect(await todasDentroDoLimite(sb, [ip, email])).toBe(false);
  });

  it("fail-open (com log) se o banco falhar", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const comErro: RpcClient = { rpc: async () => ({ data: null, error: { message: "function does not exist" } }) };
    const explode: RpcClient = { rpc: async () => Promise.reject(new Error("rede")) };
    expect(await dentroDoLimite(comErro, "k", { max: 1, janelaSegundos: 1 })).toBe(true);
    expect(await dentroDoLimite(explode, "k", { max: 1, janelaSegundos: 1 })).toBe(true);
    expect(erro).toHaveBeenCalledTimes(2);
    erro.mockRestore();
  });

  it("chaveLimite não expõe o valor e normaliza caixa/espaços", () => {
    const k = chaveLimite("ativar:email", " Maria@Exemplo.com ");
    expect(k).toMatch(/^ativar:email:[0-9a-f]{64}$/);
    expect(k).not.toContain("maria");
    expect(chaveLimite("ativar:email", "maria@exemplo.com")).toBe(k);
  });

  it("ipDaRequisicao usa o primeiro do x-forwarded-for", () => {
    const req = (h: Record<string, string>) => new Request("http://x/", { headers: h });
    expect(ipDaRequisicao(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(ipDaRequisicao(req({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(ipDaRequisicao(req({}))).toBe("desconhecido");
  });

  it("limites da ativação são de força bruta, não de uso normal", () => {
    expect(LIMITES_ATIVACAO.porEmail.max).toBeGreaterThanOrEqual(3);
    expect(LIMITES_ATIVACAO.porIp.max).toBeGreaterThanOrEqual(LIMITES_ATIVACAO.porEmail.max);
  });
});
