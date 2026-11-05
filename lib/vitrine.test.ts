import { describe, expect, it } from "vitest";
import { linkPedido, loginAnonimoLigado, precoDaVariacao } from "./vitrine";

const anel = { nome: "Anel Solitário", preco_venda: 50 };
const aro18 = { nome: "Aro 18", preco_ajuste: 5.5 };

describe("vitrine", () => {
  it("preço da variação soma o ajuste", () => {
    expect(precoDaVariacao(anel, aro18)).toBe(55.5);
    expect(precoDaVariacao(anel)).toBe(50);
  });

  it("pedido pelo WhatsApp leva produto, variação e preço", () => {
    const l = linkPedido("83999990000", anel, aro18);
    expect(l.startsWith("https://wa.me/5583999990000?text=")).toBe(true);
    const t = decodeURIComponent(l.split("text=")[1]);
    expect(t).toContain("Anel Solitário (Aro 18)");
    expect(t).toContain("55,50");
  });

  it("loja sem WhatsApp não gera link", () => {
    expect(linkPedido(null, anel)).toBe("");
  });

  it("lê o login anônimo das configurações do Supabase", async () => {
    const resp = (b: any, ok = true) => (async () => ({ ok, json: async () => b })) as unknown as typeof fetch;
    expect(await loginAnonimoLigado("http://x", "k", resp({ external: { anonymous_users: false } }))).toBe(false);
    expect(await loginAnonimoLigado("http://x", "k", resp({ external: { anonymous_users: true } }))).toBe(true);
  });

  it("sem resposta clara: não sabe (null), não 'desligado'", async () => {
    const quebra = (async () => {
      throw new Error("rede");
    }) as unknown as typeof fetch;
    expect(await loginAnonimoLigado("http://x", "k", quebra)).toBeNull();
    expect(await loginAnonimoLigado("http://x", "k", (async () => ({ ok: false })) as unknown as typeof fetch)).toBeNull();
  });
});
