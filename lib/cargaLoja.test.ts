import { describe, expect, it } from "vitest";
import { falhaDeRedeAuth, falhasDaRota, recursoAusente, recursosFalhos, textoFalhas } from "./cargaLoja";

describe("cargaLoja", () => {
  it("a tela só bloqueia pelo que ela usa", () => {
    expect(falhasDaRota("/produtos", ["produtos", "vendas"])).toEqual(["produtos"]);
    expect(falhasDaRota("/vender", ["vendas"])).toEqual([]);
    expect(falhasDaRota("/conversas", ["produtos"])).toEqual([]);
  });

  it("histórico antigo que não veio não derruba tela nenhuma", () => {
    for (const r of ["/painel", "/relatorios", "/financeiro", "/analytics"])
      expect(falhasDaRota(r, ["vendasAntigas"])).toEqual([]);
  });

  it("recursoAusente reconhece tabela/função inexistente, não erro de rede", () => {
    expect(recursoAusente({ code: "42P01" })).toBe(true);
    expect(recursoAusente({ code: "PGRST202" })).toBe(true);
    expect(recursoAusente({ code: "" })).toBe(false);
    expect(recursoAusente(null)).toBe(false);
  });

  it("recursosFalhos ignora opcional ausente, mas não opcional com erro de rede", () => {
    const rede = { code: "", message: "Failed to fetch" };
    expect(recursosFalhos({ produtos: null, vendas: rede })).toEqual(["vendas"]);
    expect(recursosFalhos({ contasPagar: { code: "42P01" } }, ["contasPagar"])).toEqual([]);
    expect(recursosFalhos({ contasPagar: rede }, ["contasPagar"])).toEqual(["contasPagar"]);
  });

  it("textoFalhas monta a frase em pt-BR", () => {
    expect(textoFalhas(["produtos"])).toBe("produtos");
    expect(textoFalhas(["produtos", "vendas", "membros"])).toBe("produtos, vendas e equipe");
  });

  it("falhaDeRedeAuth separa queda de falta de sessão", () => {
    expect(falhaDeRedeAuth({ name: "AuthRetryableFetchError", status: 0 })).toBe(true);
    expect(falhaDeRedeAuth({ name: "AuthApiError", status: 500 })).toBe(true);
    expect(falhaDeRedeAuth({ name: "AuthSessionMissingError", status: 400 })).toBe(false);
    expect(falhaDeRedeAuth({ name: "AuthApiError", status: 403 })).toBe(false);
    expect(falhaDeRedeAuth(null)).toBe(false);
  });
});
